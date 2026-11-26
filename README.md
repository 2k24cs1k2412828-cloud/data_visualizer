# NexusEDA - Enterprise Exploratory Data Analysis & Visual Intelligence Suite

A professional, high-performance web application designed to run a rigorous **10-Point Pre-Modeling Data Investigation** and generate **10 Interactive Statistical Visualizations** upon uploading any CSV dataset.

---

## 🌟 Capabilities Overview

### Part 1: First 10 Things to Find (Pre-Modeling Investigations)
1. **Dataset Shape**: Exact row count, column count, matrix cells, and deep memory footprint.
2. **Data Types**: Categorizes numerical, categorical, datetime, boolean, and text columns with model preprocessing instructions.
3. **Missing Values**: Quantitative null tally, missing percentages, visual indicators, and imputation guidance (Mean/Median/KNN vs Drop).
4. **Duplicate Records**: Exact row duplication and partial duplicate detection to avoid data leakage and skewed model weights.
5. **Statistical Summary**: Comprehensive five-number summary (Min, Q1, Median, Q3, Max) alongside Mean, Std Dev, IQR, and Skewness.
6. **Unique Values / Cardinality**: Distinct value counts and ratios; flags constant columns (zero variance), ID keys, and high-cardinality nominals.
7. **Target Distribution**: Multi-class classification balance checking & imbalanced warnings vs regression target density, spread, and skewness.
8. **Outlier Detection**: Tukey's 1.5×IQR boundary analysis detecting extreme anomalies with capping/winsorization recommendations.
9. **Feature Relationships**: Cross-correlation matrix and highest correlated pairs ranked with multicollinearity risk alerts (|r| > 0.8).
10. **Data Quality & Leakage Audit**: Automated scanning for zero-variance features, ID proxies, target proxies, and inconsistent casing/whitespace.

---

### Part 2: First 10 Interactive Visualizations
1. **Missing Values Heatmap**: High-density 2D visual matrix showing null distribution patterns across features and rows.
2. **Histograms (Numerical Features)**: Interactive bin distribution with mean/median markers.
3. **Box Plots & Outlier Spread**: Quartile distribution with upper/lower whiskers and highlighted anomalous points.
4. **Count Plots (Categorical Features)**: Categorical frequency analysis to inspect category representations.
5. **Correlation Heatmap**: Full interactive Pearson correlation matrix (-1.00 to +1.00) with intuitive color gradient.
6. **Scatter Plots**: Bivariate continuous feature analysis with scatter points and correlation coefficients.
7. **Target Distribution Plot**: Dynamic doughnut/pie chart for classification tasks or continuous density for regression.
8. **Pair Plot (Matrix)**: Multi-variable simultaneous bivariate scatter grid and univariate diagonal densities.
9. **Feature vs Target Plots**: Box plots across target classes (classification) or bivariate scatter (regression).
10. **Time-Series Plot**: Temporal trends, seasonality, and drift tracking over time when date columns are present.

---

## 🚀 Quick Start

The application runs locally on `http://localhost:8501`.

```bash
# Start the application server:
./run.sh
```

Or run directly:
```bash
python3 -m uvicorn main:app --host 0.0.0.0 --port 8501
```

Open your browser at **`http://localhost:8501`**.
