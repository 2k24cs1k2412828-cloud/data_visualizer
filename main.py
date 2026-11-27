import os
import io
import warnings
import pandas as pd
import numpy as np
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from typing import Optional, List
from analytics import analyze_dataset
from ai_synthesizer import synthesize_multiple_files
from auto_preprocessor import clean_and_preprocess_dataset

warnings.filterwarnings("ignore")

# Security hardening: disable interactive documentation (/docs, /redoc, /openapi.json) in production
is_prod = os.getenv("VERCEL_ENV") == "production" or os.getenv("ENVIRONMENT") == "production"

app = FastAPI(
    title="QUBRIX Engine",
    docs_url=None if is_prod else "/docs",
    redoc_url=None if is_prod else "/redoc",
    openapi_url=None if is_prod else "/openapi.json"
)

# CORS Security: restrict methods and headers
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://datavisualizer-seven.vercel.app",
        "http://localhost:8501",
        "http://127.0.0.1:8501",
        "http://localhost:8000"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# Global Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response

# Store dataset in memory for the active session
current_session = {
    "df": None,
    "filename": None,
    "last_analysis": None
}

def generate_sample_dataset(dataset_type: str = "customer_churn") -> pd.DataFrame:
    np.random.seed(42)
    n = 350
    if dataset_type == "customer_churn":
        # Realistic customer churn dataset with missingness, duplicates, outliers, datetime
        dates = pd.date_range(start="2024-01-01", periods=n, freq="D")
        ages = np.random.normal(38, 12, n).round()
        ages[ages < 18] = 18
        ages[3] = 115  # intentional outlier
        ages[15] = 108 # intentional outlier

        income = np.random.normal(65000, 22000, n).round(-2)
        income[7] = 450000 # extreme outlier
        
        tenure_months = np.random.randint(1, 72, n)
        monthly_charges = np.random.normal(70, 30, n).round(2)
        monthly_charges[monthly_charges < 20] = 20.0
        
        contract_type = np.random.choice(["Month-to-Month", "One Year", "Two Year"], size=n, p=[0.55, 0.25, 0.20])
        payment_method = np.random.choice(["Electronic Check", "Mailed Check", "Bank Transfer", "Credit Card"], size=n)
        support_calls = np.random.poisson(2, n)
        
        # Target churn logic
        churn_prob = 1 / (1 + np.exp(-(
            (monthly_charges - 60) * 0.04 +
            (support_calls - 2) * 0.5 -
            (tenure_months - 20) * 0.03 +
            (contract_type == "Month-to-Month") * 0.8
        )))
        churn = (np.random.rand(n) < churn_prob).astype(int)
        
        customer_ids = [f"CUST-{1000 + i}" for i in range(n)]
        
        df = pd.DataFrame({
            "CustomerID": customer_ids,
            "SignupDate": dates.strftime('%Y-%m-%d'),
            "Age": ages,
            "Income": income,
            "TenureMonths": tenure_months,
            "MonthlyCharges": monthly_charges,
            "Contract": contract_type,
            "PaymentMethod": payment_method,
            "SupportCalls": support_calls,
            "Churn": churn
        })
        
        # Inject realistic missing values
        df.loc[np.random.choice(n, 18, replace=False), "Income"] = np.nan
        df.loc[np.random.choice(n, 12, replace=False), "Age"] = np.nan
        df.loc[np.random.choice(n, 6, replace=False), "Contract"] = np.nan
        
        # Inject duplicates
        df = pd.concat([df, df.iloc[[10, 25, 50]]], ignore_index=True)
        return df

    elif dataset_type == "housing_prices":
        # Regression dataset
        n = 300
        sqft = np.random.normal(1800, 500, n).round()
        bedrooms = np.random.choice([1, 2, 3, 4, 5], size=n, p=[0.1, 0.3, 0.35, 0.2, 0.05])
        bathrooms = bedrooms + np.random.choice([0, 1], size=n, p=[0.7, 0.3])
        neighborhood = np.random.choice(["Downtown", "Suburbs", "West End", "North Hills"], size=n)
        year_built = np.random.randint(1970, 2024, size=n)
        price = (sqft * 210 + bedrooms * 15000 + (2024 - year_built) * (-500) + np.random.normal(0, 25000, n)).round(-2)
        price[12] = 1200000 # outlier
        df = pd.DataFrame({
            "ListingID": [f"PROP-{2000 + i}" for i in range(n)],
            "SquareFeet": sqft,
            "Bedrooms": bedrooms,
            "Bathrooms": bathrooms,
            "Neighborhood": neighborhood,
            "YearBuilt": year_built,
            "SalePrice": price
        })
        df.loc[np.random.choice(n, 10, replace=False), "SquareFeet"] = np.nan
        return df

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "NexusEDA Engine"}

@app.post("/api/upload")
async def upload_csv(file: UploadFile = File(...), target_col: Optional[str] = Form(None)):
    try:
        contents = await file.read()
        try:
            df = pd.read_csv(io.BytesIO(contents))
        except Exception:
            # Fallback with different encoding or separator
            try:
                df = pd.read_csv(io.BytesIO(contents), sep=None, engine='python')
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Could not parse CSV: {str(e)}")

        if df.empty:
            raise HTTPException(status_code=400, detail="The uploaded CSV file is empty.")

        analysis = analyze_dataset(df, target_col=target_col)
        current_session["df"] = df
        current_session["filename"] = file.filename
        current_session["last_analysis"] = analysis

        return {
            "success": True,
            "filename": file.filename,
            "data": analysis
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/reanalyze")
def reanalyze(target_col: str = Form(...)):
    if current_session["df"] is None:
        raise HTTPException(status_code=400, detail="No active dataset. Please upload a file first.")
    
    df = current_session["df"]
    analysis = analyze_dataset(df, target_col=target_col)
    current_session["last_analysis"] = analysis
    return {
        "success": True,
        "filename": current_session["filename"],
        "data": analysis
    }

@app.post("/api/synthesize")
async def synthesize_file(
    files: List[UploadFile] = File(...),
    prompt: Optional[str] = Form(""),
    auto_visualize: Optional[bool] = Form(True)
):
    """
    Multi-Format Dataset Synthesizer.
    Takes N number of files in ANY format (PDF, JSON, Excel, TXT, CSV) + user prompt,
    synthesizes and combines them into a single clean model-ready CSV dataset.
    """
    try:
        if not files:
            raise HTTPException(status_code=400, detail="No files uploaded.")

        files_data = []
        for f in files:
            content = await f.read()
            if content:
                files_data.append((content, f.filename))

        if not files_data:
            raise HTTPException(status_code=400, detail="All uploaded files are empty.")

        # Run multi-file synthesizer
        df = synthesize_multiple_files(files_data, prompt or "")

        if df.empty:
            raise HTTPException(status_code=400, detail="Synthesized dataset contains no records.")

        # Convert to CSV string for direct download
        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)
        csv_string = csv_buffer.getvalue()

        if len(files_data) == 1:
            clean_filename = f"synthesized_{os.path.splitext(files_data[0][1])[0]}.csv"
        else:
            clean_filename = f"unified_dataset_{len(files_data)}_files.csv"

        # If user wants instant visualization
        analysis = None
        if auto_visualize:
            analysis = analyze_dataset(df)
            current_session["df"] = df
            current_session["filename"] = clean_filename
            current_session["last_analysis"] = analysis

        return {
            "success": True,
            "filename": clean_filename,
            "file_count": len(files_data),
            "csv_data": csv_string,
            "shape": {"rows": int(len(df)), "columns": int(len(df.columns))},
            "columns": list(df.columns),
            "data": analysis
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Synthesis failed: {str(e)}")

@app.post("/api/preprocess")
async def preprocess_dataset_endpoint(
    file: Optional[UploadFile] = File(None),
    target_col: Optional[str] = Form(None),
    use_sample: Optional[str] = Form(None)
):
    """
    Feature 3: Autonomous Data Scientist & Auto-Preprocessing Engine.
    Cleans raw CSV end-to-end, imputes missing values, caps Tukey outliers,
    drops leakage/ID columns, and recommends optimal Machine Learning models.
    """
    try:
        if use_sample:
            df = generate_sample_dataset(use_sample)
            fname = f"sample_{use_sample}.csv"
        elif file:
            content = await file.read()
            if not content:
                raise HTTPException(status_code=400, detail="Uploaded file is empty.")
            try:
                df = pd.read_csv(io.BytesIO(content))
            except Exception:
                df = pd.read_csv(io.BytesIO(content), sep=None, engine='python')
            fname = file.filename
        else:
            raise HTTPException(status_code=400, detail="Please upload a CSV or select a demo dataset.")

        if df.empty:
            raise HTTPException(status_code=400, detail="The dataset contains no records.")

        # Run Auto-Preprocessing & ML Advisor
        result = clean_and_preprocess_dataset(df, target_col=target_col)

        cleaned_df = result["cleaned_df"]
        csv_buffer = io.StringIO()
        cleaned_df.to_csv(csv_buffer, index=False)
        clean_csv_string = csv_buffer.getvalue()

        clean_fname = f"model_ready_{os.path.splitext(fname)[0]}.csv"

        # Also run QUBRIX EDA on the newly cleaned dataset
        cleaned_analysis = analyze_dataset(cleaned_df, target_col=result["target_col"])
        current_session["df"] = cleaned_df
        current_session["filename"] = clean_fname
        current_session["last_analysis"] = cleaned_analysis

        return {
            "success": True,
            "original_filename": fname,
            "cleaned_filename": clean_fname,
            "csv_data": clean_csv_string,
            "target_col": result["target_col"],
            "ml_task": result["ml_task"],
            "task_detail": result["task_detail"],
            "audit_before": result["audit_before"],
            "audit_after": result["audit_after"],
            "actions_taken": result["actions_taken"],
            "ml_recommendations": result["ml_recommendations"],
            "eda_data": cleaned_analysis
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Preprocessing failed: {str(e)}")

@app.get("/api/sample/{sample_name}")
def load_sample(sample_name: str):
    df = generate_sample_dataset(sample_name)
    fname = f"sample_{sample_name}.csv"
    target = "Churn" if sample_name == "customer_churn" else "SalePrice"
    analysis = analyze_dataset(df, target_col=target)
    current_session["df"] = df
    current_session["filename"] = fname
    current_session["last_analysis"] = analysis
    return {
        "success": True,
        "filename": fname,
        "data": analysis
    }

# Mount static files
frontend_dist = os.path.join(os.path.dirname(__file__), "frontend")
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
