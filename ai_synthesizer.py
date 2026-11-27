"""
QUBRIX Intelligent Multi-Format Dataset Synthesizer Engine
Extracts, structures, cleans, and merges tabular data from multiple files (PDF, JSON, Excel, TXT, CSV)
into a unified dataset.
"""

import os
import io
import json
import re
import pandas as pd
import numpy as np
import urllib.request
import urllib.error

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

FALLBACK_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-3.5-flash",
    "gemini-3.8-flash"
]

def call_gemini(prompt: str, system_instruction: str = None) -> str:
    """Invokes engine with reliable fallback across high-throughput models."""
    api_key = os.getenv("GEMINI_API_KEY", GEMINI_API_KEY)
    last_err = None

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 8192
        }
    }
    if system_instruction:
        payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}

    body = json.dumps(payload).encode("utf-8")

    for model_name in FALLBACK_MODELS:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=12) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                candidates = res_data.get("candidates", [])
                if candidates and "content" in candidates[0]:
                    parts = candidates[0]["content"].get("parts", [])
                    if parts:
                        return parts[0].get("text", "")
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode("utf-8", errors="ignore")
            last_err = f"HTTP {e.code}: {err_msg}"
            continue
        except Exception as e:
            last_err = str(e)
            continue

    raise RuntimeError(f"Engine request failed across all providers: {last_err}")


def parse_raw_file_content(file_bytes: bytes, filename: str) -> tuple[str, str]:
    """
    Parses uploaded file content according to its extension.
    Returns (extracted_text_or_json_str, format_type).
    """
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""

    if ext in ["csv", "tsv", "txt", "log"]:
        try:
            text = file_bytes.decode("utf-8", errors="replace")
            return text, ext
        except Exception:
            return file_bytes.decode("latin1", errors="replace"), ext

    elif ext == "json":
        try:
            obj = json.loads(file_bytes.decode("utf-8", errors="replace"))
            return json.dumps(obj, indent=2), "json"
        except Exception:
            return file_bytes.decode("utf-8", errors="replace"), "json"

    elif ext in ["xlsx", "xls"]:
        try:
            excel_file = io.BytesIO(file_bytes)
            xl = pd.ExcelFile(excel_file)
            sheets_data = []
            for sheet in xl.sheet_names[:3]:
                df = xl.parse(sheet)
                sheets_data.append(f"--- Sheet: {sheet} ---\n" + df.head(60).to_csv(index=False))
            return "\n\n".join(sheets_data), "excel"
        except Exception as e:
            return f"Error reading Excel binary: {e}", "excel"

    elif ext == "pdf":
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            pages_text = []
            for i, page in enumerate(reader.pages[:25]):
                txt = page.extract_text()
                if txt:
                    pages_text.append(f"--- Page {i+1} ---\n{txt}")
            return "\n\n".join(pages_text), "pdf"
        except ImportError:
            raw = file_bytes.decode("latin1", errors="ignore")
            text_pieces = re.findall(r"\(([^\(\)]+)\)", raw)
            return "\n".join(text_pieces[:500]), "pdf"
        except Exception as e:
            return f"Error reading PDF: {e}", "pdf"

    else:
        return file_bytes.decode("utf-8", errors="replace"), "unknown"


def fallback_heuristic_tabular_extractor(raw_content: str, filename: str, fmt: str) -> pd.DataFrame:
    """
    Deterministic rule-based extractor to guarantee 100% synthesis success
    even when network, quotas, or external APIs are unavailable.
    """
    lines = [line.strip() for line in raw_content.splitlines() if line.strip()]
    if not lines:
        return pd.DataFrame([{"Record_ID": 1, "Source_File": filename, "Extracted_Text": "Empty document"}])

    # Check for delimited lines (CSV / TSV / pipe)
    for delim in [",", "\t", "|", ";"]:
        header_candidate = lines[0].split(delim)
        if len(header_candidate) >= 2:
            try:
                df = pd.read_csv(io.StringIO(raw_content), sep=delim, on_bad_lines="skip")
                if not df.empty and len(df.columns) >= 2:
                    return df
            except Exception:
                pass

    # Extract numbered items / questions / headings (common in PDFs, lecture notes, exam papers, syllabus)
    items = []
    current_item = None
    item_pattern = re.compile(r"^(?:(?:Q|Question|Unit|Chapter|Section|Module)\s*[\.:#\s-]*\s*(\d+|[A-ZIVXLCDM]+)|(\d+)[\.:\)\-]\s+)(.*)$", re.IGNORECASE)

    for line in lines:
        match = item_pattern.match(line)
        if match:
            if current_item:
                items.append(current_item)
            item_id = match.group(1) or match.group(2) or str(len(items) + 1)
            content = match.group(3).strip() if match.group(3) else line
            current_item = {
                "Item_Number": item_id,
                "Heading_or_Question": content,
                "Details_or_Notes": "",
                "Source_File": filename
            }
        else:
            if current_item:
                if current_item["Details_or_Notes"]:
                    current_item["Details_or_Notes"] += " " + line
                else:
                    current_item["Details_or_Notes"] = line
            else:
                # Capture introductory or unnumbered text
                if len(items) < 30 and len(line) > 3:
                    items.append({
                        "Item_Number": str(len(items) + 1),
                        "Heading_or_Question": line[:120],
                        "Details_or_Notes": line,
                        "Source_File": filename
                    })

    if current_item:
        items.append(current_item)

    if items:
        df = pd.DataFrame(items)
        if not df.empty:
            return df

    # Fallback to paragraph chunks
    chunks = []
    chunk_size = 5
    for i in range(0, min(len(lines), 200), chunk_size):
        chunk = " ".join(lines[i:i+chunk_size])
        chunks.append({
            "Record_ID": (i // chunk_size) + 1,
            "Section_Snippet": chunk[:100] + ("..." if len(chunk) > 100 else ""),
            "Full_Content": chunk,
            "Source_File": filename
        })

    return pd.DataFrame(chunks)


def synthesize_single_file(file_bytes: bytes, filename: str, user_prompt: str) -> pd.DataFrame:
    """Synthesizes a single file into a structured DataFrame."""
    raw_content, fmt = parse_raw_file_content(file_bytes, filename)

    if fmt == "csv" and (not user_prompt or len(user_prompt.strip()) < 3):
        try:
            df = pd.read_csv(io.StringIO(raw_content))
            if not df.empty:
                return df
        except Exception:
            pass

    truncated_content = raw_content[:40000]

    system_instruction = (
        "You are an expert Data Engineer and Dataset Synthesizer. "
        "Your task is to take raw, multi-format data (PDF, JSON, logs, text, or spreadsheets) "
        "and follow the user's instructions to synthesize a clean, structured, machine-learning-ready tabular dataset. "
        "OUTPUT FORMAT RULE: You MUST return ONLY valid JSON formatted as a list of dictionaries, "
        "where each dictionary represents a row: [{\"col1\": val1, \"col2\": val2}, ...]. "
        "Do NOT include markdown formatting, backticks, or explanatory text. Return purely the JSON array."
    )

    prompt = f"""
Input File: {filename} (Format: {fmt})
User Instructions: {user_prompt if user_prompt.strip() else "Extract and structure all data cleanly into standard tabular rows and columns with appropriate data types."}

Raw Content Preview:
{truncated_content}

Synthesize this data into a structured tabular format according to the user instructions.
Ensure column headers are clean and standardized (lowercase or TitleCase, no special characters).
Normalize nulls/missing values as null.
Return ONLY the raw JSON array of records.
"""

    resp = None
    try:
        resp = call_gemini(prompt, system_instruction=system_instruction)
    except Exception as api_err:
        print(f"[Synthesizer] API call failed: {api_err}. Activating deterministic fallback parser.")
        # Seamlessly fallback to offline heuristic extraction
        return fallback_heuristic_tabular_extractor(raw_content, filename, fmt)

    clean_json_str = resp.strip()
    if clean_json_str.startswith("```"):
        clean_json_str = re.sub(r"^```(?:json)?\s*", "", clean_json_str)
        clean_json_str = re.sub(r"\s*```$", "", clean_json_str)

    records = None

    try:
        records = json.loads(clean_json_str)
    except Exception:
        pass

    if not records:
        try:
            import json_repair
            records = json_repair.loads(clean_json_str)
        except Exception:
            pass

    if not records:
        try:
            object_matches = re.findall(r"\{[^{}]+\}", clean_json_str)
            parsed_items = []
            for m in object_matches:
                try:
                    parsed_items.append(json.loads(m))
                except Exception:
                    try:
                        import json_repair
                        parsed_items.append(json_repair.loads(m))
                    except Exception:
                        continue
            if parsed_items:
                records = parsed_items
        except Exception:
            pass

    if records:
        if isinstance(records, list) and len(records) > 0:
            dict_items = [r for r in records if isinstance(r, dict)]
            if dict_items:
                return pd.DataFrame(dict_items)
        elif isinstance(records, dict):
            for k, v in records.items():
                if isinstance(v, list) and len(v) > 0 and isinstance(v[0], dict):
                    return pd.DataFrame(v)
            return pd.DataFrame([records])

    try:
        df = pd.read_csv(io.StringIO(clean_json_str))
        if not df.empty:
            return df
    except Exception:
        pass

    # If AI returned unparseable text, guarantee output via fallback
    return fallback_heuristic_tabular_extractor(raw_content, filename, fmt)


def synthesize_multiple_files(files_data: list[tuple[bytes, str]], user_prompt: str) -> pd.DataFrame:
    """
    Synthesizes multiple files (n number of files in any format) and merges them into one unified CSV DataFrame.
    """
    if not files_data:
        raise ValueError("No files provided for synthesis.")

    dfs = []
    errors = []

    for file_bytes, filename in files_data:
        try:
            df = synthesize_single_file(file_bytes, filename, user_prompt)
            if not df.empty:
                # Add file provenance column if multiple files
                if len(files_data) > 1 and "source_file" not in df.columns:
                    df.insert(0, "source_file", filename)
                dfs.append(df)
        except Exception as e:
            errors.append(f"{filename}: {str(e)}")

    if not dfs:
        raise ValueError("Failed to synthesize any of the uploaded files: " + "; ".join(errors))

    # Merge/concatenate all DataFrames
    try:
        combined_df = pd.concat(dfs, ignore_index=True, sort=False)
        return combined_df
    except Exception as e:
        # If schema mismatch, outer join
        combined_df = dfs[0]
        for next_df in dfs[1:]:
            combined_df = pd.concat([combined_df, next_df], ignore_index=True, sort=False)
        return combined_df
