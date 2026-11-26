import io
import re
import math
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
from scipy import stats

def analyze_dataset(df: pd.DataFrame, target_col: Optional[str] = None) -> Dict[str, Any]:
    """
    Performs the 10 investigations and prepares data for the 10 visualizations.
    Ensures safe fallbacks so EVERY plot always renders cleanly regardless of dataset shape.
    """
    n_rows, n_cols = df.shape
    columns = list(df.columns)
    
    # -------------------------------------------------------------
    # PART 1: 10 INVESTIGATIONS
    # -------------------------------------------------------------
    
    # 1. Dataset Shape
    shape_info = {
        "rows": int(n_rows),
        "columns": int(n_cols),
        "total_cells": int(n_rows * n_cols),
        "memory_bytes": int(df.memory_usage(deep=True).sum())
    }
    
    # 2. Data Types
    dtype_counts = {}
    col_types = {}
    for col in columns:
        s = df[col]
        if pd.api.types.is_bool_dtype(s):
            t = "Boolean"
        elif pd.api.types.is_numeric_dtype(s):
            if s.dropna().isin([0, 1]).all() and s.nunique() <= 2:
                t = "Numerical (Binary)"
            else:
                t = "Numerical"
        elif pd.api.types.is_datetime64_any_dtype(s):
            t = "Datetime"
        else:
            sample_non_null = s.dropna().astype(str).head(30)
            is_date = False
            if len(sample_non_null) > 0:
                try:
                    pd.to_datetime(sample_non_null, errors='raise')
                    is_date = True
                except Exception:
                    is_date = False
            if is_date:
                t = "Datetime"
            elif s.nunique() / max(1, len(s.dropna())) < 0.25 or s.nunique() <= 30:
                t = "Categorical"
            else:
                t = "Text / Categorical"
        col_types[col] = t
        dtype_counts[t] = dtype_counts.get(t, 0) + 1
        
    num_cols = [c for c, t in col_types.items() if "Numerical" in t]
    cat_cols = [c for c, t in col_types.items() if t in ["Categorical", "Boolean", "Text / Categorical"]]
    dt_cols = [c for c, t in col_types.items() if t == "Datetime"]
    
    # 3. Missing Values
    null_counts = df.isnull().sum()
    null_pct = (null_counts / max(1, n_rows)) * 100
    missing_records = []
    for col in columns:
        cnt = int(null_counts[col])
        pct = round(float(null_pct[col]), 2)
        missing_records.append({
            "column": col,
            "missing_count": cnt,
            "missing_percentage": pct,
            "status": "Critical (>40%)" if pct > 40 else ("Moderate (>10%)" if pct > 10 else ("Low" if pct > 0 else "Clean"))
        })
    missing_summary = {
        "total_missing_cells": int(null_counts.sum()),
        "total_missing_pct": round(float((null_counts.sum() / max(1, (n_rows * n_cols))) * 100), 2),
        "columns_with_missing": int((null_counts > 0).sum()),
        "complete_columns": int((null_counts == 0).sum()),
        "details": missing_records
    }
    
    # 4. Duplicate Records
    exact_duplicates = int(df.duplicated().sum())
    exact_dup_pct = round(float((exact_duplicates / max(1, n_rows)) * 100), 2)
    potential_feature_cols = [c for c in columns if df[c].nunique() < n_rows * 0.95]
    partial_duplicates = 0
    if potential_feature_cols and len(potential_feature_cols) >= 2:
        partial_duplicates = int(df.duplicated(subset=potential_feature_cols[:8]).sum())
    duplicate_info = {
        "exact_duplicates": exact_duplicates,
        "exact_duplicate_pct": exact_dup_pct,
        "partial_duplicates": partial_duplicates,
        "has_duplicates": exact_duplicates > 0,
        "recommendation": "Remove exact duplicates before splitting data to prevent train-test data leakage." if exact_duplicates > 0 else "Dataset is free from exact duplicate records."
    }
    
    # 5. Statistical Summary
    stats_records = []
    for col in num_cols:
        s = df[col].dropna()
        if len(s) > 0:
            q25 = float(np.percentile(s, 25))
            q75 = float(np.percentile(s, 75))
            iqr = q75 - q25
            stats_records.append({
                "column": col,
                "count": int(s.count()),
                "mean": round(float(s.mean()), 3),
                "std": round(float(s.std()), 3) if len(s) > 1 else 0.0,
                "median": round(float(s.median()), 3),
                "min": round(float(s.min()), 3),
                "q25": round(q25, 3),
                "q75": round(q75, 3),
                "max": round(float(s.max()), 3),
                "skew": round(float(s.skew()), 3) if len(s) > 2 else 0.0,
                "iqr": round(float(iqr), 3)
            })
    
    # 6. Unique Values / Cardinality
    cardinality_records = []
    for col in columns:
        n_unique = int(df[col].nunique(dropna=True))
        ratio = round(float(n_unique / max(1, n_rows)), 4)
        if n_unique == 1:
            card_type = "Constant (Zero Variance)"
        elif n_unique == n_rows:
            card_type = "Primary Key / ID"
        elif ratio > 0.6:
            card_type = "High Cardinality"
        elif n_unique <= 10:
            card_type = "Low Cardinality (Categorical)"
        else:
            card_type = "Moderate Cardinality"
        cardinality_records.append({
            "column": col,
            "unique_count": n_unique,
            "uniqueness_ratio": ratio,
            "type_classification": card_type,
            "sample_values": [str(x) for x in df[col].dropna().unique()[:5]]
        })
        
    # 7. Target Distribution
    if not target_col or target_col not in df.columns:
        common_targets = ['target', 'label', 'outcome', 'class', 'price', 'churn', 'survived', 'status', 'sales', 'revenue', 'salary']
        found = None
        for cand in common_targets:
            for c in columns:
                if cand == c.lower() or cand in c.lower().split('_'):
                    found = c
                    break
            if found:
                break
        target_col = found if found else columns[-1]
    
    target_info = {}
    if target_col in df.columns:
        ts = df[target_col]
        is_num_target = pd.api.types.is_numeric_dtype(ts) and ts.nunique() > 10
        if is_num_target:
            ts_clean = ts.dropna()
            hist_vals, bin_edges = np.histogram(ts_clean, bins=12)
            target_info = {
                "column": target_col,
                "task_type": "Regression",
                "count": int(ts_clean.count()),
                "mean": round(float(ts_clean.mean()), 3),
                "median": round(float(ts_clean.median()), 3),
                "std": round(float(ts_clean.std()), 3),
                "min": round(float(ts_clean.min()), 3),
                "max": round(float(ts_clean.max()), 3),
                "skew": round(float(ts_clean.skew()), 3) if len(ts_clean) > 2 else 0.0,
                "distribution": {
                    "hist_values": [int(x) for x in hist_vals.tolist()],
                    "bin_edges": [round(float(x), 2) for x in bin_edges.tolist()]
                }
            }
        else:
            val_counts = ts.value_counts(dropna=False).head(15)
            props = (val_counts / max(1, len(ts)) * 100).round(2)
            classes = []
            for k, v in val_counts.items():
                classes.append({
                    "class": str(k),
                    "count": int(v),
                    "percentage": float(props[k])
                })
            imbalance = False
            if len(classes) >= 2:
                max_pct = max(c["percentage"] for c in classes)
                min_pct = min(c["percentage"] for c in classes)
                if max_pct / max(0.1, min_pct) > 2.5:
                    imbalance = True
            target_info = {
                "column": target_col,
                "task_type": "Classification",
                "unique_classes": int(ts.nunique()),
                "classes": classes,
                "is_imbalanced": imbalance,
                "recommendation": "Class disparity detected. Recommend SMOTE, focal loss, or weighted cross-entropy." if imbalance else "Classes are well balanced across the sample."
            }

    # 8. Outliers (Tukey IQR)
    outlier_records = []
    total_outlier_count = 0
    for col in num_cols:
        s = df[col].dropna()
        if len(s) > 4:
            q25 = float(s.quantile(0.25))
            q75 = float(s.quantile(0.75))
            iqr = q75 - q25
            lower_bound = q25 - 1.5 * iqr
            upper_bound = q75 + 1.5 * iqr
            outliers_iqr = s[(s < lower_bound) | (s > upper_bound)]
            cnt = int(len(outliers_iqr))
            total_outlier_count += cnt
            pct = round(float(cnt / max(1, len(s)) * 100), 2)
            outlier_records.append({
                "column": col,
                "outlier_count": cnt,
                "outlier_pct": pct,
                "lower_bound": round(float(lower_bound), 3),
                "upper_bound": round(float(upper_bound), 3),
                "severity": "High (>5%)" if pct > 5 else ("Moderate (>1%)" if pct > 1 else "Low")
            })
    outlier_summary = {
        "total_anomalies_detected": total_outlier_count,
        "details": outlier_records
    }

    # 9. Feature Relationships
    correlation_matrix = {}
    top_correlated_pairs = []
    if len(num_cols) >= 2:
        corr_df = df[num_cols].corr()
        corr_dict = {}
        for r in num_cols:
            corr_dict[r] = {}
            for c in num_cols:
                val = corr_df.loc[r, c]
                corr_dict[r][c] = round(float(val), 3) if not np.isnan(val) else 0.0
        correlation_matrix = corr_dict
        
        for i, c1 in enumerate(num_cols):
            for j, c2 in enumerate(num_cols):
                if i < j:
                    val = corr_df.loc[c1, c2]
                    if not np.isnan(val):
                        top_correlated_pairs.append({
                            "feature_1": c1,
                            "feature_2": c2,
                            "correlation": round(float(val), 3),
                            "abs_correlation": round(float(abs(val)), 3)
                        })
        top_correlated_pairs.sort(key=lambda x: x["abs_correlation"], reverse=True)
        top_correlated_pairs = top_correlated_pairs[:12]
        
    # 10. Data Quality & Leakage
    quality_issues = []
    for col in columns:
        if df[col].nunique(dropna=False) <= 1:
            quality_issues.append({
                "type": "Zero Variance Feature",
                "column": col,
                "severity": "High",
                "description": f"Feature '{col}' contains only 1 constant value. Provides zero information and should be removed."
            })
    for col in columns:
        c_low = col.lower()
        if any(id_word in c_low for id_word in ['id', 'uuid', 'guid', 'index', 'account_no', 'ssn']) and df[col].nunique() > n_rows * 0.8:
            quality_issues.append({
                "type": "ID Proxy / High Overfit Risk",
                "column": col,
                "severity": "Medium",
                "description": f"Feature '{col}' behaves like a primary key ({df[col].nunique()} distinct values). High memorization risk."
            })
    if target_col in num_cols:
        for col in num_cols:
            if col != target_col:
                corr_val = df[col].corr(df[target_col])
                if not np.isnan(corr_val) and abs(corr_val) > 0.95:
                    quality_issues.append({
                        "type": "Critical Target Leakage",
                        "column": col,
                        "severity": "Critical",
                        "description": f"Feature '{col}' has {round(corr_val, 3)} correlation with target '{target_col}'. High risk of post-event data leakage."
                    })
    for col in cat_cols:
        s = df[col].dropna().astype(str)
        unique_raw = set(s.unique())
        unique_lower = set(s.str.lower().str.strip().unique())
        if len(unique_raw) > len(unique_lower):
            quality_issues.append({
                "type": "Inconsistent Casing / Whitespace",
                "column": col,
                "severity": "Low",
                "description": f"Feature '{col}' has redundant categorical representations ({len(unique_raw)} raw vs {len(unique_lower)} standardized)."
            })
    for col in columns:
        if null_pct[col] > 50:
            quality_issues.append({
                "type": "Severe Missingness",
                "column": col,
                "severity": "High",
                "description": f"Feature '{col}' is missing {round(null_pct[col], 1)}% of values. Recommended to drop."
            })

    quality_summary = {
        "issue_count": len(quality_issues),
        "issues": quality_issues,
        "cleanliness_score": max(15, 100 - (len(quality_issues) * 12) - int(null_counts.sum() / max(1, n_rows * n_cols) * 40))
    }

    # -------------------------------------------------------------
    # PART 2: 10 VISUALIZATIONS DATA GENERATION
    # -------------------------------------------------------------
    viz_data = {}
    
    # 1. Missing Values Heatmap (sample matrix 0=present, 1=missing)
    missing_matrix_rows = min(50, n_rows)
    sub_df_missing = df.iloc[:missing_matrix_rows]
    viz_data["missing_heatmap"] = {
        "columns": columns,
        "rows": [i + 1 for i in range(missing_matrix_rows)],
        "matrix": sub_df_missing.isnull().astype(int).values.tolist(),
        "missing_per_col": [int(null_counts[c]) for c in columns]
    }
    
    # 2. Histograms (for numerical features)
    histograms = {}
    for col in num_cols[:12]:
        s = df[col].dropna()
        if len(s) > 0:
            counts, bin_edges = np.histogram(s, bins=12)
            histograms[col] = {
                "counts": counts.tolist(),
                "bins": [round(float(b), 2) for b in bin_edges.tolist()],
                "labels": [f"{round(bin_edges[i], 1)}-{round(bin_edges[i+1], 1)}" for i in range(len(counts))],
                "mean": round(float(s.mean()), 2),
                "median": round(float(s.median()), 2)
            }
    viz_data["histograms"] = histograms
    
    # 3. Box Plots (distribution metrics)
    boxplots = {}
    for col in num_cols[:12]:
        s = df[col].dropna()
        if len(s) > 0:
            q1 = float(s.quantile(0.25))
            med = float(s.median())
            q3 = float(s.quantile(0.75))
            iqr = q3 - q1
            low_whisker = float(max(s.min(), q1 - 1.5 * iqr))
            high_whisker = float(min(s.max(), q3 + 1.5 * iqr))
            outliers = s[(s < low_whisker) | (s > high_whisker)].tolist()
            boxplots[col] = {
                "min": round(float(s.min()), 2),
                "q1": round(q1, 2),
                "median": round(med, 2),
                "q3": round(q3, 2),
                "max": round(float(s.max()), 2),
                "lower_whisker": round(low_whisker, 2),
                "upper_whisker": round(high_whisker, 2),
                "outliers": [round(float(o), 2) for o in outliers[:25]]
            }
    viz_data["boxplots"] = boxplots

    # 4. Count Plots (top categorical features)
    countplots = {}
    active_cats = cat_cols if cat_cols else [c for c in columns if df[c].nunique() <= 20]
    for col in active_cats[:8]:
        s = df[col].dropna().astype(str)
        vc = s.value_counts().head(10)
        countplots[col] = {
            "categories": [str(c) for c in vc.index.tolist()],
            "counts": [int(x) for x in vc.values.tolist()]
        }
    viz_data["countplots"] = countplots

    # 5. Correlation Heatmap
    viz_data["correlation_heatmap"] = {
        "columns": num_cols[:10],
        "matrix": [[correlation_matrix.get(r, {}).get(c, 0.0) for c in num_cols[:10]] for r in num_cols[:10]] if num_cols else []
    }

    # 6. Scatter Plots
    scatter_data = {}
    scatter_pairs_to_use = []
    if len(top_correlated_pairs) > 0:
        for p in top_correlated_pairs[:6]:
            scatter_pairs_to_use.append((p["feature_1"], p["feature_2"], p["correlation"]))
    elif len(num_cols) >= 2:
        for i in range(min(4, len(num_cols) - 1)):
            scatter_pairs_to_use.append((num_cols[i], num_cols[i+1], round(float(df[num_cols[i]].corr(df[num_cols[i+1]])), 3)))

    for f1, f2, corr in scatter_pairs_to_use:
        sub = df[[f1, f2]].dropna()
        if len(sub) > 250:
            sub = sub.sample(250, random_state=42)
        scatter_data[f"{f1} vs {f2}"] = {
            "x_col": f1,
            "y_col": f2,
            "points": [{"x": round(float(r[f1]), 3), "y": round(float(r[f2]), 3)} for _, r in sub.iterrows()],
            "correlation": corr
        }
    viz_data["scatter_plots"] = scatter_data

    # 7. Target Distribution Plot
    viz_data["target_distribution"] = target_info

    # 8. Pair Plot (multi-variable sample matrix of top 3-4 features)
    pairplot_cols = num_cols[:4]
    pairplot_data = {"columns": pairplot_cols, "samples": []}
    if len(pairplot_cols) >= 2:
        sub = df[pairplot_cols].dropna()
        if len(sub) > 120:
            sub = sub.sample(120, random_state=42)
        pairplot_data["samples"] = [
            {c: round(float(row[c]), 2) for c in pairplot_cols}
            for _, row in sub.iterrows()
        ]
    viz_data["pairplot"] = pairplot_data

    # 9. Feature vs Target Plots
    feat_vs_target = {}
    if target_col in df.columns:
        if target_info.get("task_type") == "Classification":
            for col in num_cols[:6]:
                if col != target_col:
                    grouped = []
                    unique_classes = df[target_col].dropna().unique()[:6]
                    for cls_val in unique_classes:
                        vals = df[df[target_col] == cls_val][col].dropna()
                        if len(vals) > 0:
                            grouped.append({
                                "class": str(cls_val),
                                "mean": round(float(vals.mean()), 2),
                                "median": round(float(vals.median()), 2),
                                "q25": round(float(vals.quantile(0.25)), 2),
                                "q75": round(float(vals.quantile(0.75)), 2)
                            })
                    feat_vs_target[col] = {"type": "grouped_box", "feature": col, "data": grouped}
        else:
            for col in num_cols[:6]:
                if col != target_col:
                    sub = df[[col, target_col]].dropna()
                    if len(sub) > 200:
                        sub = sub.sample(200, random_state=42)
                    feat_vs_target[col] = {
                        "type": "scatter",
                        "feature": col,
                        "target": target_col,
                        "points": [{"x": round(float(r[col]), 2), "y": round(float(r[target_col]), 2)} for _, r in sub.iterrows()]
                    }
    viz_data["feature_vs_target"] = feat_vs_target

    # 10. Time-Series Plot (with smart synthetic index fallback if non-temporal)
    timeseries_data = None
    best_dt_col = dt_cols[0] if dt_cols else None
    if not best_dt_col:
        for c in columns:
            if any(term in c.lower() for term in ['date', 'time', 'timestamp', 'year', 'month', 'day', 'created', 'period']):
                best_dt_col = c
                break

    if best_dt_col and num_cols:
        try:
            ts_copy = df[[best_dt_col, num_cols[0]]].dropna().copy()
            ts_copy['parsed_dt'] = pd.to_datetime(ts_copy[best_dt_col], errors='coerce')
            ts_copy = ts_copy.dropna().sort_values('parsed_dt')
            if len(ts_copy) > 0:
                if len(ts_copy) > 200:
                    step = max(1, len(ts_copy) // 150)
                    ts_copy = ts_copy.iloc[::step]
                timeseries_data = {
                    "is_actual_datetime": True,
                    "datetime_column": best_dt_col,
                    "value_column": num_cols[0],
                    "series": [
                        {"t": str(r['parsed_dt'])[:10], "v": round(float(r[num_cols[0]]), 2)}
                        for _, r in ts_copy.iterrows()
                    ]
                }
        except Exception:
            timeseries_data = None

    # Fallback to Sequence / Row Index Trend Plot if no date is present
    if not timeseries_data and num_cols:
        target_eval_col = num_cols[0] if num_cols[0] != target_col else (num_cols[1] if len(num_cols) > 1 else num_cols[0])
        s_vals = df[target_eval_col].dropna()
        sample_size = min(150, len(s_vals))
        step = max(1, len(s_vals) // sample_size)
        sampled_vals = s_vals.iloc[::step].head(150)
        timeseries_data = {
            "is_actual_datetime": False,
            "datetime_column": "Row Sequence Index",
            "value_column": target_eval_col,
            "series": [
                {"t": f"Row #{idx + 1}", "v": round(float(val), 2)}
                for idx, val in enumerate(sampled_vals)
            ]
        }
            
    viz_data["timeseries"] = timeseries_data

    return {
        "target_col": target_col,
        "all_columns": columns,
        "numerical_columns": num_cols,
        "categorical_columns": cat_cols,
        "datetime_columns": dt_cols,
        "investigations": {
            "shape": shape_info,
            "data_types": {"column_types": col_types, "type_counts": dtype_counts},
            "missing_values": missing_summary,
            "duplicate_records": duplicate_info,
            "statistical_summary": stats_records,
            "cardinality": cardinality_records,
            "target_distribution": target_info,
            "outliers": outlier_summary,
            "feature_relationships": {
                "top_correlated_pairs": top_correlated_pairs,
                "correlation_matrix": correlation_matrix
            },
            "data_quality_leakage": quality_summary
        },
        "visualizations": viz_data,
        "raw_preview": df.head(15).replace({np.nan: None}).to_dict(orient="records")
    }
