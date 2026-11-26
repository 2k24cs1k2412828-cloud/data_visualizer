# QUBRIX — Intelligent Data Visualizer & Automated EDA Suite

> **Explore • Analyze • Discover**  
> Effortless, zero-code exploratory data analysis, automated data health auditing, and interactive visual intelligence for everyone.

---

## 📖 Welcome to QUBRIX

**QUBRIX** is an intelligent web application built to help analysts, researchers, students, and professionals understand their data in seconds. 

Instead of writing dozens of lines of repetitive code to inspect column types, check for missing values, calculate statistics, or generate charts, QUBRIX does it all automatically. Simply upload any CSV dataset, and QUBRIX instantly performs a **10-Point Pre-Modeling Data Health Audit** and generates **10 Interactive Statistical Visualizations**.

---

## 📋 Table of Contents
1. [Account Creation & Sign In](#-account-creation--sign-in)
2. [User Profile & Onboarding](#-user-profile--onboarding)
3. [Analysis History](#-analysis-history)
4. [Uploading & Analyzing Data](#-uploading--analyzing-data)
5. [Demo Datasets](#-demo-datasets)
6. [The 10 Data Health Investigations](#-the-10-data-health-investigations)
7. [The 10 Interactive Visualizations](#-the-10-interactive-visualizations)
8. [Target Column Selection & Live Re-analysis](#-target-column-selection--live-re-analysis)
9. [Raw Data Explorer & Exporting Reports](#-raw-data-explorer--exporting-reports)
10. [Seamless Navigation (Back to Home)](#-seamless-navigation-back-to-home)
11. [Tips & Supported Data](#-tips--supported-data)

---

## 🔐 Account Creation & Sign In

QUBRIX protects your workspace and data analyses with built-in user accounts. You must be signed in to upload files, run audits, or view history.

### 1. Creating a New Account (Sign Up)
- Click the **"Sign In"** or **"Get Started"** button on the home page.
- Switch to the **Sign Up** tab on the modal.
- You can register in two ways:
  - **Continue with Google**: One-click registration using your existing Google account.
  - **Email & Password**: Enter a unique username, your email address, and a secure password.
- After creating an account for the first time, you will automatically be guided to the **Onboarding screen**.

### 2. Signing In
- If you already have an account, click **Sign In**.
- Choose your sign-in method:
  - **Continue with Google**
  - **Email or Username + Password**: You can sign in using either your email address or your chosen username.
- Once signed in, your initials or profile avatar will appear in the top-right corner of the navigation bar.

### 3. Signing Out
- Click your profile avatar in the top-right corner to open the user menu.
- Click **"Sign Out"** to end your session.

---

## 👤 User Profile & Onboarding

### Initial Onboarding
When you sign up, QUBRIX helps personalize your workspace through a quick onboarding step:
- **First & Last Name**: How you want your name displayed.
- **Occupation / Role**: Select from common roles (*Working Professional, Student, Teacher, Data Analyst, or Other*).
- **Profile Picture**: Optionally upload your own avatar photo directly from your device (supports JPG, PNG, WEBP up to 2MB).

### Managing Your Profile
At any time, you can click your avatar in the top-right header and select **"Profile"**:
- View your account details (Name, Username, Email, and Role).
- Update your profile photo by uploading a new image.
- Change your occupation role whenever your needs evolve.

---

## 📜 Analysis History

Every time you analyze a dataset on QUBRIX, a summary card is saved to your account.

- **How to view history**: Click your avatar in the top-right corner and select **"Profile"**, then scroll down to the **Analysis History** section.
- **What is recorded**:
  - Dataset file name.
  - Dimensions (total rows and columns).
  - Target column selected.
  - Missing values percentage.
  - Overall Data Quality Score (e.g., `100/100`).
  - Date and time of analysis.
- **Refresh button**: Quickly reload your latest analysis records without refreshing the web page.

---

## 🚀 Uploading & Analyzing Data

Analyzing your data takes just three steps:

### 1. Choose Your File
- Click **"Upload CSV"** in the top navigation bar, OR
- Drag and drop your `.csv` file directly onto the upload box on the homepage, OR
- Click **"Browse Files"** to pick a file from your computer.

*(Note: If you are not signed in, QUBRIX will gently prompt you to sign in before processing begins.)*

### 2. Automated Processing
Once uploaded, QUBRIX reads your dataset, detects column structures, detects potential target variables, runs all statistical algorithms, and prepares the visualization charts. A clean loading screen keeps you informed during this brief processing step.

### 3. The Interactive Dashboard
Once processing completes, your screen switches directly to the **Analysis Dashboard**, organized into three organized tabs:
- **10 Investigations**: In-depth health checks, summary tables, and quality alerts.
- **10 Visualizations**: Interactive, zoomable charts for distributions, outliers, and correlations.
- **Raw Data**: A spreadsheet-style preview of your dataset.

---

## 🧪 Demo Datasets

If you do not have a CSV file on hand and want to test QUBRIX immediately, use one of our pre-loaded sample datasets available on the home page:

1. **Customer Churn (Classification)**:
   - 353 rows × 10 columns.
   - Ideal for exploring customer retention, churn drivers, and categorical class distributions.
2. **Housing Prices (Regression)**:
   - 300 rows × 6 columns.
   - Ideal for exploring real estate values, numerical distributions, outliers, and price predictors.

Simply click on either sample card to load and analyze it with one click.

---

## 🔍 The 10 Data Health Investigations

Under the **10 Investigations** tab, QUBRIX presents 10 essential data health checkpoints to ensure your dataset is clean, balanced, and ready for modeling or decision-making:

### 1. Dataset Shape & Dimensions
Shows total rows, total columns, total matrix data cells, and calculated memory usage so you immediately know the scale of your data.

### 2. Data Types Breakdown
Categorizes your columns into numerical, categorical, date/time, boolean, or unstructured text, complete with counts for each category.

### 3. Missing Values & Completeness
Scans every single cell for missing or blank data. It highlights which columns have nulls, calculates the exact percentage of missing entries, and flags high-risk columns.

### 4. Duplicate Records
Identifies exact duplicate rows across the entire dataset so you can avoid duplicate biases and skewed findings.

### 5. Five-Number Summary & Descriptive Statistics
Computes key numerical statistics for every continuous feature: Minimum, 25th percentile (Q1), Median, 75th percentile (Q3), Maximum, Mean, Standard Deviation, and Skewness.

### 6. Cardinality & Unique Values
Analyzes the uniqueness of each column's entries. Automatically alerts you to constant columns (zero variance) or ID-like columns that contain distinct values on every row.

### 7. Target Distribution & Balance
Inspects the chosen outcome column:
- For **Classification**: shows class balance, category percentages, and flags potential class imbalances.
- For **Regression**: shows mean value, standard deviation, and value spread.

### 8. Outlier Detection (Tukey's Method)
Uses statistical interquartile range (IQR) boundaries to detect extreme values and anomalies in every numerical feature, reporting the exact number of outliers detected.

### 9. Feature Relationships & Multicollinearity
Calculates Pearson cross-correlations across all numerical features and ranks the strongest positive and negative relationships. Alerts you if any pair of features is so strongly correlated that it risks data redundancy.

### 10. Data Quality Score & Health Audit
Provides an overall **Cleanliness Score out of 100** along with a clear list of actionable notices (e.g., whether any columns have high missing rates, zero variance, or potential data leakage).

---

## 📊 The 10 Interactive Visualizations

Under the **10 Visualizations** tab, you have access to 10 interactive charts powered by high-performance visual libraries:

1. **Missing Values Heatmap**: A visual matrix displaying where missing data points live across all rows and columns.
2. **Numerical Feature Histograms**: Frequency histograms with an interactive dropdown selector to explore the distribution shape of any numerical column.
3. **Box Plots & Outlier Spread**: Interactive box-and-whisker plots highlighting medians, quartiles, and detected outlier points for each feature.
4. **Categorical Count Plots**: Bar charts showing the breakdown and frequency counts of categories within any discrete column.
5. **Correlation Heatmap**: A high-contrast color matrix displaying relationship strengths between all continuous variables.
6. **Bivariate Scatter Plot**: Interactive scatter visualization with dual dropdown selectors (X-axis vs. Y-axis) to inspect relationships between any two variables.
7. **Target Distribution Chart**: Visual display of your target variable (doughnut chart for classification tasks, distribution chart for regression tasks).
8. **Pair Plot Matrix**: A multi-chart grid showing pairwise comparisons and distributions across your top numerical features.
9. **Feature vs. Target Plot**: Visualizes how individual predictor features behave across different values or classes of the target column.
10. **Time-Series / Sequence Trend**: Tracks changes and trends over time if a date column is present, or plots the sequence order.

---

## 🎯 Target Column Selection & Live Re-analysis

QUBRIX automatically detects and suggests the most likely target (outcome) column in your dataset upon upload.

However, you have full control:
- In the top action bar of the dashboard, you will find the **Target Column Dropdown**.
- Change the selected target to any column you wish to predict or analyze.
- QUBRIX instantly re-runs the target distribution, feature-vs-target relationships, and task classification (Classification vs. Regression) in real time without having to re-upload your file.

---

## 📑 Raw Data Explorer & Exporting Reports

### Raw Data Explorer
Want to inspect the raw spreadsheet rows? Click the **"Raw Data"** tab in the dashboard. QUBRIX displays an interactive preview of your dataset records with clean pagination so you can verify row values directly.

### Exporting Audit Reports
Need to share your findings or keep an audit log for compliance?
- Click the **"Export JSON Audit"** button in the dashboard toolbar.
- QUBRIX instantly downloads a complete audit file named `qubrix_audit_<timestamp>.json` containing all 10 investigation results, statistics, outlier tallies, and quality scores.

---

## 🏠 Seamless Navigation (Back to Home)

Whenever you finish reviewing a dataset or want to analyze a different file:
- Click the **"Back to Home"** button located in the top-left section of the dashboard navigation bar.
- You are seamlessly returned to the clean homepage where you can upload a new dataset or pick a sample.
- No page reload is needed, and your login session remains uninterrupted.

---

## 💡 Tips & Supported Data

- **Supported File Types**: Standard `.csv` (Comma-Separated Values) format.
- **File Size Limit**: Supports files up to **200 MB**.
- **Data Cleanliness**: Files with clean headers in the first row produce the cleanest audit results.
- **Privacy First**: Your datasets are processed securely, and your analysis history is linked strictly to your authenticated account.

---

*QUBRIX — Intelligent Exploratory Data Analysis made simple.*
