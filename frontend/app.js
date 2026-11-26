/**
 * DataProfiler - Executive Visual Analytics Engine
 * Professional multi-color chart palettes (Datadog / Tableau / Snowflake inspired)
 */

let globalData = null;
let chartInstances = {};

// Executive Enterprise Palette
const PALETTE = {
  indigo: '#4f46e5',
  indigoFill: 'rgba(79, 70, 229, 0.75)',
  sky: '#0284c7',
  skyFill: 'rgba(2, 132, 199, 0.75)',
  teal: '#0d9488',
  tealFill: 'rgba(13, 148, 136, 0.75)',
  amber: '#d97706',
  amberFill: 'rgba(217, 119, 6, 0.75)',
  rose: '#e11d48',
  roseFill: 'rgba(225, 29, 72, 0.75)',
  violet: '#7c3aed',
  violetFill: 'rgba(124, 58, 237, 0.75)',
  slate: '#475569',
  slateFill: 'rgba(71, 85, 105, 0.75)',
  grid: '#f1f5f9',
  axis: '#64748b',
  categorical: [
    '#4f46e5', '#0284c7', '#0d9488', '#d97706', '#7c3aed', '#e11d48', '#059669', '#ea580c'
  ]
};

// Initial DOM Setup: Strictly stays on Landing Page
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  setupUploadListeners();
});

// Setup click and drop listeners
function setupUploadListeners() {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileUploadInput');
  const sampleBtn = document.getElementById('sampleDatasetsBtn');
  const sampleMenu = document.getElementById('sampleMenu');

  sampleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    sampleMenu.classList.toggle('hidden');
  });
  document.addEventListener('click', () => {
    sampleMenu.classList.add('hidden');
  });

  if (dropZone) {
    dropZone.addEventListener('click', () => fileInput.click());
    
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.add('border-indigo-500', 'bg-indigo-50/20');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-indigo-500', 'bg-indigo-50/20');
      });
    });

    dropZone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileUpload(files[0]);
      }
    });
  }

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  });
}

function resetToHome() {
  document.getElementById('dashboardState').classList.add('hidden');
  document.getElementById('activeFileBadge').classList.add('hidden');
  document.getElementById('activeFileBadge').classList.remove('flex');
  document.getElementById('heroUploadState').classList.remove('hidden');
  globalData = null;
}

function showLoading(show, message = "Analyzing Dataset...") {
  const overlay = document.getElementById('loadingOverlay');
  const statusTxt = document.getElementById('loadingStatusText');
  if (statusTxt) statusTxt.textContent = message;
  if (show) {
    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
  } else {
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
  }
}

// Upload file to FastAPI backend
async function handleFileUpload(file) {
  if (!file.name.endsWith('.csv')) {
    alert("Please select a valid CSV file.");
    return;
  }
  showLoading(true, `Uploading & Profiling ${file.name}...`);
  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.detail || "Failed to process dataset");
    
    renderAppWithData(result.filename, result.data);
  } catch (err) {
    alert("Error processing CSV: " + err.message);
  } finally {
    showLoading(false);
  }
}

// Load sample dataset
async function loadSample(sampleName) {
  showLoading(true, `Loading demo benchmark dataset...`);
  try {
    const res = await fetch(`/api/sample/${sampleName}`);
    const result = await res.json();
    if (!res.ok) throw new Error(result.detail || "Failed to load sample");
    renderAppWithData(result.filename, result.data);
  } catch (err) {
    console.error("Error loading sample:", err);
  } finally {
    showLoading(false);
  }
}

// Change ML Target Column
async function onTargetChanged() {
  const select = document.getElementById('targetSelect');
  const newTarget = select.value;
  showLoading(true, `Re-evaluating investigations with target: ${newTarget}...`);

  const formData = new FormData();
  formData.append('target_col', newTarget);

  try {
    const res = await fetch('/api/reanalyze', {
      method: 'POST',
      body: formData
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.detail || "Reanalysis failed");
    renderAppWithData(result.filename, result.data);
  } catch (err) {
    alert("Reanalysis error: " + err.message);
  } finally {
    showLoading(false);
  }
}

// Tab Switching
function switchMainTab(tab) {
  const tabs = ['investigations', 'visualizations', 'rawdata'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`);
    const content = document.getElementById(`tabContent${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (t === tab) {
      btn.className = "px-3.5 py-1.5 rounded-md text-xs font-bold transition flex items-center space-x-1.5 bg-white text-indigo-700 shadow-xs";
      content.classList.remove('hidden');
    } else {
      btn.className = "px-3.5 py-1.5 rounded-md text-xs font-bold transition flex items-center space-x-1.5 text-slate-600 hover:text-slate-900";
      content.classList.add('hidden');
    }
  });

  if (tab === 'visualizations') {
    setTimeout(renderAllVisualizations, 50);
  }
}

// =========================================================
// RENDER MAIN APPLICATION WITH DATA
// =========================================================
function renderAppWithData(filename, data) {
  globalData = data;

  // Reveal dashboard, hide hero
  document.getElementById('heroUploadState').classList.add('hidden');
  document.getElementById('dashboardState').classList.remove('hidden');
  
  // Header badge
  const badge = document.getElementById('activeFileBadge');
  badge.classList.remove('hidden');
  badge.classList.add('flex');
  document.getElementById('activeFileName').textContent = filename;
  const inv = data.investigations;
  document.getElementById('activeFileShape').textContent = `${inv.shape.rows} × ${inv.shape.columns}`;

  // Target Select options
  const targetSelect = document.getElementById('targetSelect');
  targetSelect.innerHTML = '';
  data.all_columns.forEach(col => {
    const opt = document.createElement('option');
    opt.value = col;
    opt.textContent = col;
    if (col === data.target_col) opt.selected = true;
    targetSelect.appendChild(opt);
  });

  const taskType = inv.target_distribution.task_type || "Classification";
  const badgeEl = document.getElementById('targetTaskBadge');
  badgeEl.textContent = taskType;

  // Render Top 4 Summary Cards
  document.getElementById('cardShapeVal').textContent = `${inv.shape.rows.toLocaleString()} × ${inv.shape.columns}`;
  document.getElementById('cardShapeSub').textContent = `${(inv.shape.memory_bytes / 1024).toFixed(1)} KB footprint`;

  document.getElementById('cardMissingVal').textContent = `${inv.missing_values.total_missing_pct}%`;
  document.getElementById('cardMissingSub').textContent = `${inv.missing_values.total_missing_cells} null cells in ${inv.missing_values.columns_with_missing} columns`;

  document.getElementById('cardDupVal').textContent = `${inv.duplicate_records.exact_duplicates}`;
  document.getElementById('cardDupSub').textContent = `${inv.duplicate_records.exact_duplicate_pct}% row repetition`;

  const qScore = inv.data_quality_leakage.cleanliness_score;
  const qValEl = document.getElementById('cardQualityVal');
  qValEl.textContent = `${qScore}/100`;
  document.getElementById('cardQualitySub').textContent = `${inv.data_quality_leakage.issue_count} quality checks flagged`;

  // Render Part 1: 10 Investigations
  renderPart1Investigations(data);

  // Initialize visualization controls
  initVisualizationControls(data);

  // Render Part 2: 10 Visualizations
  renderAllVisualizations();

  // Render Tab 3: Raw Table
  renderRawTable(data);

  lucide.createIcons();
}

// =========================================================
// PART 1: 10 INVESTIGATIONS RENDERERS
// =========================================================
function renderPart1Investigations(data) {
  const inv = data.investigations;

  // 1. Dataset Shape
  const shapeContainer = document.getElementById('invShapeContent');
  shapeContainer.innerHTML = `
    <div class="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70">
      <div class="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Observations (Rows)</div>
      <div class="text-xl font-black font-mono text-slate-900 mt-1">${inv.shape.rows.toLocaleString()}</div>
      <div class="text-[11px] text-slate-500 mt-0.5">Sample volume</div>
    </div>
    <div class="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70">
      <div class="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Features (Columns)</div>
      <div class="text-xl font-black font-mono text-slate-900 mt-1">${inv.shape.columns}</div>
      <div class="text-[11px] text-slate-500 mt-0.5">Feature breadth</div>
    </div>
    <div class="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70">
      <div class="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Matrix Cells</div>
      <div class="text-xl font-black font-mono text-slate-900 mt-1">${inv.shape.total_cells.toLocaleString()}</div>
      <div class="text-[11px] text-slate-500 mt-0.5">Data points</div>
    </div>
    <div class="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70">
      <div class="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Memory Allocation</div>
      <div class="text-xl font-black font-mono text-slate-900 mt-1">${(inv.shape.memory_bytes / 1024).toFixed(1)} KB</div>
      <div class="text-[11px] text-slate-500 mt-0.5">In-memory size</div>
    </div>
  `;

  // 2. Data Types
  const dtypePills = document.getElementById('dtypeSummaryPills');
  dtypePills.innerHTML = '';
  Object.entries(inv.data_types.type_counts).forEach(([t, count]) => {
    const pill = document.createElement('span');
    pill.className = `px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${getTypeBadgeClass(t)}`;
    pill.textContent = `${t}: ${count}`;
    dtypePills.appendChild(pill);
  });

  const dtypeBody = document.getElementById('dtypeTableBody');
  dtypeBody.innerHTML = '';
  Object.entries(inv.data_types.column_types).forEach(([col, t]) => {
    let prep = "Standard / Robust Scaling";
    let compat = "Direct numerical input";
    if (t.includes("Categorical")) {
      prep = "One-Hot / Target Encoding";
      compat = "Requires encoding";
    } else if (t === "Datetime") {
      prep = "Extract Year, Month, Day, DayOfWeek";
      compat = "Needs datetime parsing";
    } else if (t === "Boolean") {
      prep = "Binary 0/1 casting";
      compat = "Native tree/linear compatible";
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="font-bold text-slate-900 font-mono text-xs">${col}</td>
      <td><span class="px-2 py-0.5 rounded text-[11px] font-mono font-medium ${getTypeBadgeClass(t)}">${t}</span></td>
      <td class="text-slate-600 text-xs">${prep}</td>
      <td class="text-slate-600 text-xs">${compat}</td>
    `;
    dtypeBody.appendChild(tr);
  });

  // 3. Missing Values
  document.getElementById('missingBadgeTotal').textContent = `${inv.missing_values.total_missing_pct}% (${inv.missing_values.total_missing_cells} cells)`;
  const missingBody = document.getElementById('missingTableBody');
  missingBody.innerHTML = '';
  inv.missing_values.details.forEach(item => {
    let rec = "Clean feature — No action";
    if (item.missing_percentage > 50) rec = "Drop column (Too sparse)";
    else if (item.missing_percentage > 10) rec = "Impute via Median/KNN + Missing indicator";
    else if (item.missing_percentage > 0) rec = "Mean/Median (numeric) or Mode (categorical)";

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="font-semibold text-slate-900 font-mono text-xs">${item.column}</td>
      <td class="text-slate-700 font-mono text-xs">${item.missing_count}</td>
      <td class="font-bold font-mono text-xs ${item.missing_percentage > 0 ? (item.missing_percentage > 20 ? 'text-rose-600' : 'text-amber-600') : 'text-slate-400'}">${item.missing_percentage}%</td>
      <td>
        <div class="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
          <div class="h-full ${item.missing_percentage > 20 ? 'bg-rose-500' : (item.missing_percentage > 0 ? 'bg-amber-500' : 'bg-emerald-500')}" style="width: ${Math.max(item.missing_percentage, 0)}%"></div>
        </div>
      </td>
      <td class="text-xs text-slate-600">${rec}</td>
    `;
    missingBody.appendChild(tr);
  });

  // 4. Duplicate Records
  const dupBadge = document.getElementById('dupStatusBadge');
  const dupBox = document.getElementById('dupContentBox');
  dupBadge.textContent = inv.duplicate_records.exact_duplicates > 0 ? `${inv.duplicate_records.exact_duplicates} Duplicates` : "No Duplicates";
  
  dupBox.innerHTML = `
    <div class="flex-1 p-4 rounded-lg border border-slate-200 bg-slate-50/70">
      <div class="text-xs text-slate-500 font-bold uppercase tracking-wider">Exact Duplicate Rows</div>
      <div class="text-2xl font-black font-mono ${inv.duplicate_records.exact_duplicates > 0 ? 'text-rose-600' : 'text-emerald-600'} mt-1">
        ${inv.duplicate_records.exact_duplicates} (${inv.duplicate_records.exact_duplicate_pct}%)
      </div>
      <div class="text-xs text-slate-600 mt-1.5">${inv.duplicate_records.recommendation}</div>
    </div>
    <div class="flex-1 p-4 rounded-lg border border-slate-200 bg-slate-50/70">
      <div class="text-xs text-slate-500 font-bold uppercase tracking-wider">Partial Duplicate Subsets</div>
      <div class="text-2xl font-black font-mono text-slate-900 mt-1">${inv.duplicate_records.partial_duplicates}</div>
      <div class="text-xs text-slate-600 mt-1.5">Identical records across key predictive columns</div>
    </div>
  `;

  // 5. Statistical Summary
  const statsBody = document.getElementById('statsTableBody');
  statsBody.innerHTML = '';
  inv.statistical_summary.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="font-sans font-bold text-slate-900 text-xs">${s.column}</td>
      <td>${s.count}</td>
      <td class="font-bold text-indigo-600">${s.mean}</td>
      <td class="text-slate-500">${s.std}</td>
      <td>${s.min}</td>
      <td>${s.q25}</td>
      <td class="font-bold text-emerald-600">${s.median}</td>
      <td>${s.q75}</td>
      <td>${s.max}</td>
      <td>${s.iqr}</td>
      <td class="${Math.abs(s.skew) > 1 ? 'text-amber-600 font-bold' : 'text-slate-500'}">${s.skew}</td>
    `;
    statsBody.appendChild(tr);
  });

  // 6. Cardinality
  const cardBody = document.getElementById('cardinalityTableBody');
  cardBody.innerHTML = '';
  inv.cardinality.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="font-semibold text-slate-900 font-mono text-xs">${c.column}</td>
      <td class="font-mono text-xs text-slate-700">${c.unique_count}</td>
      <td class="font-mono text-xs text-slate-700 font-semibold">${(c.uniqueness_ratio * 100).toFixed(1)}%</td>
      <td><span class="text-xs px-2 py-0.5 rounded font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200">${c.type_classification}</span></td>
      <td class="text-slate-500 text-xs font-mono max-w-xs truncate">${c.sample_values.join(', ')}</td>
    `;
    cardBody.appendChild(tr);
  });

  // 7. Target Distribution
  const targetBody = document.getElementById('targetInvestigationBody');
  const tInfo = inv.target_distribution;
  if (tInfo.task_type === "Classification") {
    let classHtml = '';
    tInfo.classes.forEach(cls => {
      classHtml += `
        <div class="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <span class="w-3 h-3 rounded-full bg-indigo-600"></span>
            <span class="font-bold text-slate-900 text-sm font-mono">${cls.class}</span>
          </div>
          <div class="text-right">
            <span class="font-bold text-slate-900 text-sm font-mono">${cls.count}</span>
            <span class="text-xs text-slate-500 ml-1">(${cls.percentage}%)</span>
          </div>
        </div>
      `;
    });
    targetBody.innerHTML = `
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <div class="text-xs text-slate-700 font-bold uppercase tracking-wide">Target: <span class="text-slate-900 font-extrabold">${tInfo.column}</span></div>
          <span class="text-xs font-semibold ${tInfo.is_imbalanced ? 'text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded' : 'text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded'}">
            ${tInfo.is_imbalanced ? 'Imbalanced Classes' : 'Balanced Distribution'}
          </span>
        </div>
        <p class="text-xs text-slate-600">${tInfo.recommendation}</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mt-2">
          ${classHtml}
        </div>
      </div>
    `;
  } else {
    targetBody.innerHTML = `
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div class="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70">
          <div class="text-xs text-slate-500 font-bold uppercase tracking-wider">Target Variable</div>
          <div class="text-lg font-bold font-mono text-slate-900 mt-1">${tInfo.column}</div>
          <div class="text-xs text-indigo-600 mt-0.5 font-semibold">Continuous Regression</div>
        </div>
        <div class="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70">
          <div class="text-xs text-slate-500 font-bold uppercase tracking-wider">Mean Value</div>
          <div class="text-lg font-bold font-mono text-slate-900 mt-1">${tInfo.mean}</div>
          <div class="text-xs text-slate-500 mt-0.5">Median: ${tInfo.median}</div>
        </div>
        <div class="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70">
          <div class="text-xs text-slate-500 font-bold uppercase tracking-wider">Range Spread</div>
          <div class="text-lg font-bold font-mono text-slate-900 mt-1">${tInfo.min} - ${tInfo.max}</div>
          <div class="text-xs text-slate-500 mt-0.5">Std Dev: ${tInfo.std}</div>
        </div>
        <div class="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70">
          <div class="text-xs text-slate-500 font-bold uppercase tracking-wider">Skewness</div>
          <div class="text-lg font-bold font-mono text-slate-900 mt-1">${tInfo.skew}</div>
          <div class="text-xs text-slate-500 mt-0.5">${Math.abs(tInfo.skew) > 1 ? 'Skewed Distribution' : 'Symmetric'}</div>
        </div>
      </div>
    `;
  }

  // 8. Outliers
  document.getElementById('outlierBadgeCount').textContent = `${inv.outliers.total_anomalies_detected} Outliers`;
  const outBody = document.getElementById('outliersTableBody');
  outBody.innerHTML = '';
  inv.outliers.details.forEach(o => {
    let treat = "Safe — natural variance";
    if (o.outlier_pct > 5) treat = "Winsorize or use robust tree models";
    else if (o.outlier_pct > 1) treat = "Cap with 1.5×IQR boundary thresholds";

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="font-bold text-slate-900 font-mono text-xs">${o.column}</td>
      <td class="font-mono text-xs text-slate-700">${o.outlier_count}</td>
      <td class="font-mono text-xs font-bold ${o.outlier_pct > 3 ? 'text-rose-600' : 'text-slate-700'}">${o.outlier_pct}%</td>
      <td class="text-slate-600 font-mono text-xs">${o.lower_bound}</td>
      <td class="text-slate-600 font-mono text-xs">${o.upper_bound}</td>
      <td><span class="text-xs px-2 py-0.5 rounded font-mono font-medium ${o.severity.includes('High') ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-slate-100 text-slate-700 border border-slate-200'}">${o.severity}</span></td>
      <td class="text-xs text-slate-600 font-sans">${treat}</td>
    `;
    outBody.appendChild(tr);
  });

  // 9. Feature Relationships
  const relBody = document.getElementById('featureRelBody');
  const pairs = inv.feature_relationships.top_correlated_pairs || [];
  if (pairs.length === 0) {
    relBody.innerHTML = `<div class="col-span-2 text-xs text-slate-500">Not enough numerical features for cross-correlation.</div>`;
  } else {
    let pairCardsHtml = pairs.slice(0, 6).map(p => `
      <div class="p-3 rounded-lg border border-slate-200 bg-slate-50/70 flex items-center justify-between">
        <div>
          <div class="text-xs font-bold text-slate-900 font-mono">${p.feature_1} ↔ ${p.feature_2}</div>
          <div class="text-[11px] text-slate-500">${Math.abs(p.correlation) > 0.7 ? 'Strong linear correlation' : 'Moderate correlation'}</div>
        </div>
        <div class="font-mono font-extrabold text-sm ${p.correlation > 0 ? 'text-teal-600' : 'text-rose-600'}">${p.correlation > 0 ? '+' : ''}${p.correlation}</div>
      </div>
    `).join('');
    relBody.innerHTML = `
      <div class="space-y-2">
        <div class="text-xs font-bold text-slate-600 uppercase tracking-wider">Top Correlated Pairs</div>
        <div class="space-y-2">${pairCardsHtml}</div>
      </div>
      <div class="p-4 rounded-lg border border-slate-200 bg-slate-50/70 flex flex-col justify-between">
        <div>
          <div class="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Multicollinearity Guidance</div>
          <p class="text-xs text-slate-600 leading-relaxed mb-4">
            Pairs exceeding <strong>|0.80|</strong> induce severe multicollinearity in linear models. Consider dropping redundant collinear features.
          </p>
        </div>
        <button onclick="switchMainTab('visualizations')" class="w-full py-2 rounded-lg bg-white hover:bg-slate-50 text-xs font-bold text-indigo-600 border border-slate-300 shadow-2xs transition">
          View Interactive Correlation Heatmap →
        </button>
      </div>
    `;
  }

  // 10. Data Quality & Leakage
  const qList = document.getElementById('qualityIssuesList');
  const issues = inv.data_quality_leakage.issues || [];
  if (issues.length === 0) {
    qList.innerHTML = `
      <div class="p-3.5 rounded-lg border border-slate-200 bg-emerald-50/50 text-xs text-emerald-800 flex items-center space-x-2 font-medium">
        <i data-lucide="check-circle" class="w-4 h-4 text-emerald-600"></i>
        <span>No critical quality issues or proxy leakage vectors found. Dataset is well-formed!</span>
      </div>
    `;
  } else {
    qList.innerHTML = issues.map(iss => {
      let color = "amber";
      if (iss.severity === "Critical" || iss.severity === "High") color = "rose";
      return `
        <div class="p-3 rounded-lg border border-${color}-200 bg-${color}-50/40 flex items-start justify-between">
          <div>
            <div class="text-xs font-bold text-slate-900 font-mono">${iss.type} (${iss.column})</div>
            <p class="text-xs text-slate-600 mt-0.5">${iss.description}</p>
          </div>
          <span class="text-[10px] font-bold font-mono uppercase px-2 py-0.5 rounded bg-${color}-100 text-${color}-800 ml-3 shrink-0">${iss.severity}</span>
        </div>
      `;
    }).join('');
  }
}

function getTypeBadgeClass(t) {
  if (t.includes("Numerical")) return "badge-numeric";
  if (t.includes("Categorical")) return "badge-categorical";
  if (t === "Datetime") return "badge-datetime";
  if (t === "Boolean") return "badge-boolean";
  return "bg-slate-100 text-slate-700 border border-slate-200";
}

// =========================================================
// PART 2: 10 VISUALIZATIONS RENDERERS (EXECUTIVE THEME)
// =========================================================
function initVisualizationControls(data) {
  const viz = data.visualizations;

  // 2. Histogram Select
  const histSelect = document.getElementById('histFeatureSelect');
  histSelect.innerHTML = '';
  Object.keys(viz.histograms || {}).forEach(k => {
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = k;
    histSelect.appendChild(opt);
  });

  // 3. Boxplot Select
  const boxSelect = document.getElementById('boxFeatureSelect');
  boxSelect.innerHTML = '';
  Object.keys(viz.boxplots || {}).forEach(k => {
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = k;
    boxSelect.appendChild(opt);
  });

  // 4. Countplot Select
  const countSelect = document.getElementById('countFeatureSelect');
  countSelect.innerHTML = '';
  Object.keys(viz.countplots || {}).forEach(k => {
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = k;
    countSelect.appendChild(opt);
  });

  // 6. Scatter Select
  const scatterSelect = document.getElementById('scatterPairSelect');
  scatterSelect.innerHTML = '';
  Object.keys(viz.scatter_plots || {}).forEach(k => {
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = k;
    scatterSelect.appendChild(opt);
  });

  // 9. Feat vs Target Select
  const fvtSelect = document.getElementById('featVsTargetSelect');
  fvtSelect.innerHTML = '';
  Object.keys(viz.feature_vs_target || {}).forEach(k => {
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = k;
    fvtSelect.appendChild(opt);
  });
}

function renderAllVisualizations() {
  if (!globalData) return;
  renderMissingHeatmap();
  renderHistogramChart();
  renderBoxplotChart();
  renderCountPlotChart();
  renderCorrelationHeatmap();
  renderScatterChart();
  renderTargetDistChart();
  renderPairplotGrid();
  renderFeatVsTargetChart();
  renderTimeSeriesChart();
}

function getOrCreateChart(canvasId, config) {
  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
  }
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  chartInstances[canvasId] = new Chart(ctx, config);
  return chartInstances[canvasId];
}

// 1. Missing Values Heatmap (High Resolution Matrix)
function renderMissingHeatmap() {
  const canvas = document.getElementById('canvasMissingHeatmap');
  const viz = globalData.visualizations.missing_heatmap;
  if (!canvas || !viz || !viz.matrix || viz.matrix.length === 0) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const numRows = viz.matrix.length;
  const numCols = viz.columns.length;
  const w = rect.width / numCols;
  const h = (rect.height - 25) / numRows;

  ctx.clearRect(0, 0, rect.width, rect.height);

  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      const isMissing = viz.matrix[r][c] === 1;
      ctx.fillStyle = isMissing ? '#e11d48' : '#e2e8f0';
      ctx.fillRect(c * w, r * h, Math.max(1, w - 1), Math.max(1, h - 1));
    }
  }

  // Column names
  ctx.fillStyle = '#64748b';
  ctx.font = '10px JetBrains Mono, monospace';
  for (let c = 0; c < numCols; c++) {
    const name = viz.columns[c].slice(0, 8);
    ctx.fillText(name, c * w + 2, rect.height - 8);
  }

  const missingSum = viz.missing_per_col.reduce((a, b) => a + b, 0);
  document.getElementById('missingHeatmapSummary').textContent = `${missingSum} missing cells in matrix`;
}

// 2. Histograms (Deep Indigo / Sky Bars)
function renderHistogramChart() {
  const select = document.getElementById('histFeatureSelect');
  if (!select || !select.value) return;
  const feat = select.value;
  const hist = globalData.visualizations.histograms[feat];
  if (!hist) return;

  getOrCreateChart('canvasHistogram', {
    type: 'bar',
    data: {
      labels: hist.labels,
      datasets: [{
        label: `${feat}`,
        data: hist.counts,
        backgroundColor: '#4f46e5',
        borderColor: '#4338ca',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: PALETTE.axis, font: { size: 9, family: 'JetBrains Mono' } }, grid: { display: false } },
        y: { ticks: { color: PALETTE.axis, font: { size: 10 } }, grid: { color: PALETTE.grid } }
      }
    }
  });

  document.getElementById('histStatsFooter').innerHTML = `
    <span>Mean: <strong class="text-slate-900">${hist.mean}</strong></span>
    <span>Median: <strong class="text-slate-900">${hist.median}</strong></span>
  `;
}

// 3. Box Plots (Quartiles & Bounds in Teal / Sky)
function renderBoxplotChart() {
  const select = document.getElementById('boxFeatureSelect');
  if (!select || !select.value) return;
  const feat = select.value;
  const b = globalData.visualizations.boxplots[feat];
  if (!b) return;

  getOrCreateChart('canvasBoxplot', {
    type: 'bar',
    data: {
      labels: ['Min / Lower Fence', 'Q1 (25%)', 'Median', 'Q3 (75%)', 'Max / Upper Fence'],
      datasets: [{
        label: `${feat}`,
        data: [b.lower_whisker, b.q1, b.median, b.q3, b.upper_whisker],
        backgroundColor: ['#38bdf8', '#0284c7', '#0d9488', '#0284c7', '#38bdf8'],
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: PALETTE.axis, font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: PALETTE.axis, font: { size: 10 } }, grid: { color: PALETTE.grid } }
      }
    }
  });

  document.getElementById('boxStatsFooter').innerHTML = `
    <span>IQR: <strong class="text-slate-900">${(b.q3 - b.q1).toFixed(2)}</strong></span>
    <span>Outliers: <strong class="text-rose-600 font-bold">${b.outliers.length}</strong></span>
  `;
}

// 4. Count Plots (Categorical Multi-Color Bars)
function renderCountPlotChart() {
  const select = document.getElementById('countFeatureSelect');
  if (!select || !select.value) return;
  const feat = select.value;
  const c = globalData.visualizations.countplots[feat];
  if (!c) return;

  const barColors = c.categories.map((_, i) => PALETTE.categorical[i % PALETTE.categorical.length]);

  getOrCreateChart('canvasCountplot', {
    type: 'bar',
    data: {
      labels: c.categories,
      datasets: [{
        label: feat,
        data: c.counts,
        backgroundColor: barColors,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: PALETTE.axis, font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: PALETTE.axis, font: { size: 10 } }, grid: { color: PALETTE.grid } }
      }
    }
  });

  const total = c.counts.reduce((a, b) => a + b, 0);
  document.getElementById('countPlotFooter').innerHTML = `
    <span>Categories: <strong class="text-slate-900">${c.categories.length}</strong></span>
    <span>Total Observations: <strong class="text-slate-900">${total}</strong></span>
  `;
}

// 5. Correlation Heatmap (Teal / Indigo / Rose Grid)
function renderCorrelationHeatmap() {
  const container = document.getElementById('corrHeatmapContainer');
  const h = globalData.visualizations.correlation_heatmap;
  if (!container) return;
  if (!h || !h.columns || h.columns.length === 0) {
    container.innerHTML = `<div class="text-xs text-slate-500 py-8">No numerical features for correlation matrix.</div>`;
    return;
  }

  const cols = h.columns;
  const n = cols.length;

  let tableHtml = `<div class="inline-block overflow-hidden"><table class="border-collapse text-xs font-mono">`;
  
  tableHtml += `<tr><th></th>`;
  cols.forEach(c => {
    tableHtml += `<th class="px-2.5 py-1.5 text-slate-600 font-bold text-center truncate max-w-[85px]">${c.slice(0, 8)}</th>`;
  });
  tableHtml += `</tr>`;

  for (let r = 0; r < n; r++) {
    tableHtml += `<tr><th class="px-2.5 py-1.5 text-slate-600 font-bold text-right truncate max-w-[90px]">${cols[r].slice(0, 8)}</th>`;
    for (let c = 0; c < n; c++) {
      const val = h.matrix[r][c];
      const bg = getExecutiveCorrColor(val);
      const txtColor = Math.abs(val) > 0.4 ? '#ffffff' : '#0f172a';
      tableHtml += `<td class="p-2.5 text-center font-bold corr-cell rounded-xs cursor-pointer" style="background-color: ${bg}; color: ${txtColor};" title="${cols[r]} vs ${cols[c]}: ${val}">${val.toFixed(2)}</td>`;
    }
    tableHtml += `</tr>`;
  }
  tableHtml += `</table></div>`;
  container.innerHTML = tableHtml;
}

function getExecutiveCorrColor(val) {
  if (val === 1.0) return '#059669';
  if (val > 0) {
    return `rgba(13, 148, 136, ${Math.max(0.12, val * 0.9)})`;
  } else {
    return `rgba(225, 29, 72, ${Math.max(0.12, Math.abs(val) * 0.9)})`;
  }
}

// 6. Scatter Plots (Sky / Indigo Accent Points)
function renderScatterChart() {
  const select = document.getElementById('scatterPairSelect');
  if (!select || !select.value) return;
  const pairKey = select.value;
  const p = globalData.visualizations.scatter_plots[pairKey];
  if (!p) return;

  getOrCreateChart('canvasScatter', {
    type: 'scatter',
    data: {
      datasets: [{
        label: pairKey,
        data: p.points,
        backgroundColor: 'rgba(2, 132, 199, 0.75)',
        borderColor: '#0284c7',
        pointRadius: 3.5,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: p.x_col, color: PALETTE.axis, font: { size: 10 } }, ticks: { color: PALETTE.axis }, grid: { color: PALETTE.grid } },
        y: { title: { display: true, text: p.y_col, color: PALETTE.axis, font: { size: 10 } }, ticks: { color: PALETTE.axis }, grid: { color: PALETTE.grid } }
      }
    }
  });

  document.getElementById('scatterFooter').innerHTML = `
    <span>Pearson (r): <strong class="text-sky-600">${p.correlation}</strong></span>
    <span>Observations: <strong class="text-slate-900">${p.points.length}</strong></span>
  `;
}

// 7. Target Distribution Plot (Multi-Class Donut or Density)
function renderTargetDistChart() {
  const tInfo = globalData.visualizations.target_distribution;
  const badge = document.getElementById('targetPlotTypeBadge');
  badge.textContent = tInfo.task_type;

  if (tInfo.task_type === "Classification") {
    const labels = tInfo.classes.map(c => c.class);
    const data = tInfo.classes.map(c => c.count);

    getOrCreateChart('canvasTargetDist', {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: PALETTE.categorical.slice(0, labels.length),
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: '#334155', font: { family: 'Plus Jakarta Sans', size: 11, weight: '500' } } }
        }
      }
    });

    document.getElementById('targetPlotFooter').innerHTML = `
      <span>Class Balance: <strong class="${tInfo.is_imbalanced ? 'text-amber-600' : 'text-emerald-600'}">${tInfo.is_imbalanced ? 'Imbalanced' : 'Balanced'}</strong></span>
      <span>Classes: <strong class="text-slate-900">${tInfo.unique_classes}</strong></span>
    `;
  } else {
    const dist = tInfo.distribution;
    getOrCreateChart('canvasTargetDist', {
      type: 'bar',
      data: {
        labels: dist.bin_edges.slice(0, -1).map((b, i) => `${b}-${dist.bin_edges[i+1]}`),
        datasets: [{
          label: tInfo.column,
          data: dist.hist_values,
          backgroundColor: '#4f46e5',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: PALETTE.axis, font: { size: 9, family: 'JetBrains Mono' } }, grid: { display: false } },
          y: { ticks: { color: PALETTE.axis }, grid: { color: PALETTE.grid } }
        }
      }
    });

    document.getElementById('targetPlotFooter').innerHTML = `
      <span>Mean: <strong class="text-slate-900">${tInfo.mean}</strong></span>
      <span>Skew: <strong class="text-slate-900">${tInfo.skew}</strong></span>
    `;
  }
}

// 8. Pair Plot Matrix (Multi-Feature Micro Charts)
function renderPairplotGrid() {
  const container = document.getElementById('pairplotGridContainer');
  const pp = globalData.visualizations.pairplot;
  if (!container) return;
  if (!pp || !pp.columns || pp.columns.length < 2) {
    container.innerHTML = `<div class="text-xs text-slate-500 py-6 text-center">Pair plot requires at least two numerical features.</div>`;
    return;
  }

  const cols = pp.columns;
  const n = cols.length;
  
  let gridHtml = `<div class="grid" style="grid-template-columns: repeat(${n}, minmax(130px, 1fr)); gap: 8px;">`;
  
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const cid = `pair_c_${r}_${c}`;
      gridHtml += `
        <div class="h-28 rounded-lg bg-white border border-slate-200 p-1.5 flex flex-col justify-between shadow-2xs">
          <div class="text-[9px] font-mono text-slate-500 font-bold truncate">${cols[r].slice(0,6)} / ${cols[c].slice(0,6)}</div>
          <div class="relative h-20 w-full">
            <canvas id="${cid}"></canvas>
          </div>
        </div>
      `;
    }
  }
  gridHtml += `</div>`;
  container.innerHTML = gridHtml;

  setTimeout(() => {
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const cid = `pair_c_${r}_${c}`;
        const canvas = document.getElementById(cid);
        if (!canvas) continue;

        if (r === c) {
          const vals = pp.samples.map(s => s[cols[r]]);
          getOrCreateChart(cid, {
            type: 'bar',
            data: {
              labels: vals.slice(0, 10).map((_, i) => i),
              datasets: [{
                data: vals.slice(0, 10),
                backgroundColor: '#0d9488',
                borderWidth: 0
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: { x: { display: false }, y: { display: false } }
            }
          });
        } else {
          const pts = pp.samples.map(s => ({ x: s[cols[c]], y: s[cols[r]] }));
          getOrCreateChart(cid, {
            type: 'scatter',
            data: {
              datasets: [{
                data: pts,
                backgroundColor: 'rgba(79, 70, 229, 0.75)',
                pointRadius: 2.5
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: { x: { display: false }, y: { display: false } }
            }
          });
        }
      }
    }
  }, 50);
}

// 9. Feature vs Target Plots (Violet / Indigo Medians)
function renderFeatVsTargetChart() {
  const select = document.getElementById('featVsTargetSelect');
  if (!select || !select.value) return;
  const feat = select.value;
  const fvt = globalData.visualizations.feature_vs_target[feat];
  if (!fvt) return;

  if (fvt.type === "grouped_box") {
    const labels = fvt.data.map(d => `Class ${d.class}`);
    const medians = fvt.data.map(d => d.median);
    const colors = labels.map((_, i) => PALETTE.categorical[i % PALETTE.categorical.length]);

    getOrCreateChart('canvasFeatVsTarget', {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: `${feat} Median`,
          data: medians,
          backgroundColor: colors,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: PALETTE.axis, font: { size: 10 } }, grid: { display: false } },
          y: { ticks: { color: PALETTE.axis, font: { size: 10 } }, grid: { color: PALETTE.grid } }
        }
      }
    });

    document.getElementById('featVsTargetFooter').innerHTML = `
      <span>Feature: <strong class="text-slate-900">${feat}</strong></span>
      <span>Distribution grouped across target classes</span>
    `;
  } else {
    getOrCreateChart('canvasFeatVsTarget', {
      type: 'scatter',
      data: {
        datasets: [{
          label: `${feat} vs ${fvt.target}`,
          data: fvt.points,
          backgroundColor: 'rgba(124, 58, 237, 0.75)',
          borderColor: '#7c3aed',
          pointRadius: 3.5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { title: { display: true, text: feat, color: PALETTE.axis }, ticks: { color: PALETTE.axis }, grid: { color: PALETTE.grid } },
          y: { title: { display: true, text: fvt.target, color: PALETTE.axis }, ticks: { color: PALETTE.axis }, grid: { color: PALETTE.grid } }
        }
      }
    });

    document.getElementById('featVsTargetFooter').innerHTML = `
      <span>Relationship: <strong class="text-slate-900">${feat} vs ${fvt.target}</strong></span>
      <span>Continuous bivariate relationship</span>
    `;
  }
}

// 10. Time-Series Plot (Indigo Area Fill)
function renderTimeSeriesChart() {
  const ts = globalData.visualizations.timeseries;
  const statusTag = document.getElementById('tsStatusTag');

  if (!ts || !ts.series || ts.series.length === 0) {
    statusTag.textContent = "Non-Sequential";
    document.getElementById('tsFooter').textContent = "No sequential trends found";
    return;
  }

  statusTag.textContent = ts.is_actual_datetime ? `Timeline (${ts.datetime_column})` : `Sequence (${ts.datetime_column})`;

  const labels = ts.series.map(s => s.t);
  const data = ts.series.map(s => s.v);

  getOrCreateChart('canvasTimeSeries', {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: `${ts.value_column}`,
        data: data,
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79, 70, 229, 0.08)',
        borderWidth: 2,
        fill: true,
        tension: 0.15,
        pointRadius: 1.5,
        pointHoverRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: PALETTE.axis, maxTicksLimit: 7 }, grid: { display: false } },
        y: { ticks: { color: PALETTE.axis }, grid: { color: PALETTE.grid } }
      }
    }
  });

  document.getElementById('tsFooter').innerHTML = `
    <span>Observations: <strong class="text-slate-900">${ts.series.length}</strong></span>
    <span>Feature: <strong class="text-indigo-600">${ts.value_column}</strong></span>
  `;
}

// =========================================================
// TAB 3: RAW TABLE RENDERER & EXPORT
// =========================================================
function renderRawTable(data) {
  const header = document.getElementById('rawTableHeader');
  const body = document.getElementById('rawTableBody');

  header.innerHTML = '<tr>' + data.all_columns.map(c => `<th class="whitespace-nowrap">${c}</th>`).join('') + '</tr>';

  body.innerHTML = data.raw_preview.map(row => {
    return '<tr>' + data.all_columns.map(c => {
      const val = row[c];
      const isNull = val === null || val === undefined;
      return `<td class="font-mono text-xs whitespace-nowrap ${isNull ? 'text-rose-600 font-bold bg-rose-50/50' : 'text-slate-800'}">${isNull ? 'null' : val}</td>`;
    }).join('') + '</tr>';
  }).join('');
}

function downloadCleanReport() {
  if (!globalData) return;
  const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(globalData, null, 2));
  const dlAnchorElem = document.createElement('a');
  dlAnchorElem.setAttribute("href", jsonStr);
  dlAnchorElem.setAttribute("download", `dataprofiler_audit_${Date.now()}.json`);
  dlAnchorElem.click();
}
