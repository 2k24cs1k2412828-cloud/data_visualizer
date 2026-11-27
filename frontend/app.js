/**
 * DataProfiler - Clean SaaS UI & Chart Orchestration
 */

let globalData = null;
let chartInstances = {};

// Clean SaaS Chart Palette (Dark slate, subdued blues, warm grays)
const SAAS_COLORS = {
  primary: '#1f2937',      // gray-800
  primaryFill: 'rgba(31, 41, 55, 0.85)',
  blue: '#2563eb',         // blue-600
  blueFill: 'rgba(37, 99, 235, 0.75)',
  emerald: '#059669',      // emerald-600
  amber: '#d97706',        // amber-600
  rose: '#e11d48',         // rose-600
  grid: '#f3f4f6',         // gray-100
  text: '#6b7280'          // gray-500
};

// On DOM Loaded: strictly DO NOT auto-load any dummy dataset!
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  setupUploadListeners();
  
  // Re-render canvas heatmap when window is resized
  window.addEventListener('resize', () => {
    const vizTab = document.getElementById('tabContentVisualizations');
    if (vizTab && !vizTab.classList.contains('hidden') && globalData) {
      renderMissingHeatmap();
    }
  });
});

// Check if user is authenticated before performing actions
function requireAuth(actionCallback) {
  // Check if firebase auth has an active user
  const user = (typeof auth !== 'undefined' && auth) ? auth.currentUser : null;
  if (user) {
    if (actionCallback) actionCallback();
    return true;
  }
  // Not authenticated: prompt user to create account or sign in first
  if (typeof openAuthModal === 'function') {
    openAuthModal('signup');
  }
  return false;
}

// Global function to trigger upload safely from any button
function triggerUpload() {
  if (!requireAuth()) {
    return;
  }
  const fileInput = document.getElementById('fileUploadInput');
  if (fileInput) {
    fileInput.click();
  }
}

// Setup drag and drop & click listeners
function setupUploadListeners() {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileUploadInput');
  const sampleBtn = document.getElementById('sampleDatasetsBtn');
  const sampleMenu = document.getElementById('sampleMenu');

  if (sampleBtn && sampleMenu) {
    sampleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      sampleMenu.classList.toggle('hidden');
    });
    document.addEventListener('click', () => {
      sampleMenu.classList.add('hidden');
    });
  }

  if (dropZone) {
    dropZone.addEventListener('click', (e) => {
      // Prevent double firing if clicking button inside
      e.preventDefault();
      triggerUpload();
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.add('border-gray-500', 'bg-gray-50');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-gray-500', 'bg-gray-50');
      });
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        if (!requireAuth()) return;
        handleFileUpload(files[0]);
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        if (!requireAuth()) {
          fileInput.value = '';
          return;
        }
        handleFileUpload(e.target.files[0]);
      }
    });
  }
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
  if (!requireAuth()) return;
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
  if (!requireAuth()) return;
  showLoading(true, `Loading demo dataset...`);
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
      btn.className = "px-3 py-1.5 rounded text-xs font-medium transition bg-gray-900 text-white";
      content.classList.remove('hidden');
    } else {
      btn.className = "px-3 py-1.5 rounded text-xs font-medium transition text-gray-600 hover:text-gray-900";
      content.classList.add('hidden');
    }
  });

  if (tab === 'visualizations') {
    // Small timeout ensures the DOM tab element is unhidden and has non-zero clientWidth
    setTimeout(renderAllVisualizations, 60);
    setTimeout(renderMissingHeatmap, 150);
  }
}

// Return to Home / Landing Upload Screen
function returnToHome() {
  // Hide dashboard, show hero upload state
  const dashboardState = document.getElementById('dashboardState');
  const heroUploadState = document.getElementById('heroUploadState');
  const activeFileBadge = document.getElementById('activeFileBadge');
  const fileInput = document.getElementById('fileUploadInput');

  if (dashboardState) dashboardState.classList.add('hidden');
  if (heroUploadState) heroUploadState.classList.remove('hidden');
  if (activeFileBadge) {
    activeFileBadge.classList.add('hidden');
    activeFileBadge.classList.remove('flex');
  }
  if (fileInput) fileInput.value = '';

  // Reset tab to investigations for next time
  switchMainTab('investigations');

  // Smooth scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =========================================================
// RENDER MAIN APPLICATION WITH DATA
// =========================================================
function renderAppWithData(filename, data) {
  globalData = data;

  // Auto-record this analysis in user Firestore history if authenticated
  if (typeof recordAnalysisInHistory === 'function') {
    recordAnalysisInHistory(filename, data);
  }

  // Hide home landing screen and ALL full-page workspace sections completely
  const heroState = document.getElementById('heroUploadState');
  const edaSection = document.getElementById('fullPageEdaSection');
  const synthSection = document.getElementById('fullPageSynthesizerSection');
  const readinessSection = document.getElementById('fullPageReadinessSection');
  const preprocessSection = document.getElementById('fullPagePreprocessSection');
  const preprocessResultsSection = document.getElementById('fullPagePreprocessResultsSection');
  const profileSection = document.getElementById('fullPageProfileSection');
  const dashboardState = document.getElementById('dashboardState');

  if (heroState) heroState.classList.add('hidden');
  if (edaSection) edaSection.classList.add('hidden');
  if (synthSection) synthSection.classList.add('hidden');
  if (readinessSection) readinessSection.classList.add('hidden');
  if (preprocessSection) preprocessSection.classList.add('hidden');
  if (preprocessResultsSection) preprocessResultsSection.classList.add('hidden');
  if (profileSection) profileSection.classList.add('hidden');

  // Display the clean, dedicated Analysis Dashboard
  if (dashboardState) dashboardState.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (window.lucide) lucide.createIcons();
  
  // Header badge
  const badge = document.getElementById('activeFileBadge');
  if (badge) {
    badge.classList.remove('hidden');
    badge.classList.add('flex');
  }
  const nameEl = document.getElementById('activeFileName');
  if (nameEl) nameEl.textContent = filename;
  const inv = data.investigations;
  const shapeEl = document.getElementById('activeFileShape');
  if (shapeEl && inv && inv.shape) {
    shapeEl.textContent = `${inv.shape.rows} × ${inv.shape.columns}`;
  }

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
  document.getElementById('cardShapeSub').textContent = `${(inv.shape.memory_bytes / 1024).toFixed(1)} KB memory`;

  document.getElementById('cardMissingVal').textContent = `${inv.missing_values.total_missing_pct}%`;
  document.getElementById('cardMissingSub').textContent = `${inv.missing_values.total_missing_cells} null cells in ${inv.missing_values.columns_with_missing} cols`;

  document.getElementById('cardDupVal').textContent = `${inv.duplicate_records.exact_duplicates}`;
  document.getElementById('cardDupSub').textContent = `${inv.duplicate_records.exact_duplicate_pct}% row repetition`;

  const qScore = inv.data_quality_leakage.cleanliness_score;
  const qValEl = document.getElementById('cardQualityVal');
  qValEl.textContent = `${qScore}/100`;
  document.getElementById('cardQualitySub').textContent = `${inv.data_quality_leakage.issue_count} quality notices`;

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
// PART 1: 10 INVESTIGATIONS RENDERERS (CLEAN PROFESSIONAL)
// =========================================================
function renderPart1Investigations(data) {
  const inv = data.investigations;

  // 1. Dataset Shape
  const shapeContainer = document.getElementById('invShapeContent');
  shapeContainer.innerHTML = `
    <div class="p-3 rounded border border-gray-200 bg-gray-50/50">
      <div class="text-[11px] text-gray-500 font-medium">Rows (Observations)</div>
      <div class="text-xl font-bold text-gray-900 mt-1">${inv.shape.rows.toLocaleString()}</div>
    </div>
    <div class="p-3 rounded border border-gray-200 bg-gray-50/50">
      <div class="text-[11px] text-gray-500 font-medium">Columns (Features)</div>
      <div class="text-xl font-bold text-gray-900 mt-1">${inv.shape.columns}</div>
    </div>
    <div class="p-3 rounded border border-gray-200 bg-gray-50/50">
      <div class="text-[11px] text-gray-500 font-medium">Matrix Cells</div>
      <div class="text-xl font-bold text-gray-900 mt-1">${inv.shape.total_cells.toLocaleString()}</div>
    </div>
    <div class="p-3 rounded border border-gray-200 bg-gray-50/50">
      <div class="text-[11px] text-gray-500 font-medium">Memory Usage</div>
      <div class="text-xl font-bold text-gray-900 mt-1">${(inv.shape.memory_bytes / 1024).toFixed(1)} KB</div>
    </div>
  `;

  // 2. Data Types
  const dtypePills = document.getElementById('dtypeSummaryPills');
  dtypePills.innerHTML = '';
  Object.entries(inv.data_types.type_counts).forEach(([t, count]) => {
    const pill = document.createElement('span');
    pill.className = "text-xs text-gray-600 bg-white border border-gray-200 px-2 py-0.5 rounded";
    pill.textContent = `${t}: ${count}`;
    dtypePills.appendChild(pill);
  });

  const dtypeBody = document.getElementById('dtypeTableBody');
  dtypeBody.innerHTML = '';
  Object.entries(inv.data_types.column_types).forEach(([col, t]) => {
    let prep = "Standard scaling / MinMax scaling";
    let compat = "Direct numeric input";
    if (t.includes("Categorical")) {
      prep = "One-Hot / Target / Ordinal Encoding";
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
      <td class="font-medium text-gray-900">${col}</td>
      <td><span class="text-xs text-gray-700 bg-gray-100 px-2 py-0.5 rounded">${t}</span></td>
      <td class="text-gray-600">${prep}</td>
      <td class="text-gray-600">${compat}</td>
    `;
    dtypeBody.appendChild(tr);
  });

  // 3. Missing Values
  document.getElementById('missingBadgeTotal').textContent = `${inv.missing_values.total_missing_pct}% (${inv.missing_values.total_missing_cells} cells)`;
  const missingBody = document.getElementById('missingTableBody');
  missingBody.innerHTML = '';
  inv.missing_values.details.forEach(item => {
    let rec = "Clean feature";
    if (item.missing_percentage > 50) rec = "Drop column (Too sparse)";
    else if (item.missing_percentage > 10) rec = "Impute via Median/KNN + Missing flag";
    else if (item.missing_percentage > 0) rec = "Mean/Median (numeric) or Mode (categorical)";

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="font-medium text-gray-900">${item.column}</td>
      <td class="text-gray-700 font-mono text-xs">${item.missing_count}</td>
      <td class="font-medium text-xs ${item.missing_percentage > 0 ? 'text-gray-900 font-bold' : 'text-gray-400'}">${item.missing_percentage}%</td>
      <td>
        <div class="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
          <div class="h-full ${item.missing_percentage > 20 ? 'bg-gray-800' : 'bg-gray-500'}" style="width: ${Math.max(item.missing_percentage, 0)}%"></div>
        </div>
      </td>
      <td class="text-xs text-gray-600">${rec}</td>
    `;
    missingBody.appendChild(tr);
  });

  // 4. Duplicate Records
  const dupBadge = document.getElementById('dupStatusBadge');
  const dupBox = document.getElementById('dupContentBox');
  dupBadge.textContent = inv.duplicate_records.exact_duplicates > 0 ? `${inv.duplicate_records.exact_duplicates} Duplicates` : "No Duplicates";
  
  dupBox.innerHTML = `
    <div class="flex-1 p-3.5 rounded border border-gray-200 bg-gray-50/50">
      <div class="text-xs text-gray-500 font-medium">Exact Duplicate Rows</div>
      <div class="text-xl font-bold text-gray-900 mt-1">
        ${inv.duplicate_records.exact_duplicates} (${inv.duplicate_records.exact_duplicate_pct}%)
      </div>
      <div class="text-xs text-gray-600 mt-1.5">${inv.duplicate_records.recommendation}</div>
    </div>
    <div class="flex-1 p-3.5 rounded border border-gray-200 bg-gray-50/50">
      <div class="text-xs text-gray-500 font-medium">Partial Overlaps</div>
      <div class="text-xl font-bold text-gray-900 mt-1">${inv.duplicate_records.partial_duplicates}</div>
      <div class="text-xs text-gray-600 mt-1.5">Repeated records across core feature dimensions</div>
    </div>
  `;

  // 5. Statistical Summary
  const statsBody = document.getElementById('statsTableBody');
  statsBody.innerHTML = '';
  inv.statistical_summary.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="font-sans font-medium text-gray-900">${s.column}</td>
      <td>${s.count}</td>
      <td class="font-semibold text-gray-900">${s.mean}</td>
      <td class="text-gray-500">${s.std}</td>
      <td>${s.min}</td>
      <td>${s.q25}</td>
      <td class="font-semibold text-gray-900">${s.median}</td>
      <td>${s.q75}</td>
      <td>${s.max}</td>
      <td>${s.iqr}</td>
      <td>${s.skew}</td>
    `;
    statsBody.appendChild(tr);
  });

  // 6. Cardinality
  const cardBody = document.getElementById('cardinalityTableBody');
  cardBody.innerHTML = '';
  inv.cardinality.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="font-medium text-gray-900">${c.column}</td>
      <td class="font-mono text-xs text-gray-700">${c.unique_count}</td>
      <td class="font-mono text-xs text-gray-700">${(c.uniqueness_ratio * 100).toFixed(1)}%</td>
      <td><span class="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">${c.type_classification}</span></td>
      <td class="text-gray-500 text-xs font-mono max-w-xs truncate">${c.sample_values.join(', ')}</td>
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
        <div class="p-3 rounded border border-gray-200 bg-gray-50/50 flex items-center justify-between">
          <span class="font-medium text-gray-900 text-sm">${cls.class}</span>
          <div class="text-right">
            <span class="font-bold text-gray-900 text-sm">${cls.count}</span>
            <span class="text-xs text-gray-500 ml-1">(${cls.percentage}%)</span>
          </div>
        </div>
      `;
    });
    targetBody.innerHTML = `
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <div class="text-xs text-gray-700 font-medium">Target: <strong class="text-gray-900">${tInfo.column}</strong></div>
          <span class="text-xs font-medium ${tInfo.is_imbalanced ? 'text-amber-700' : 'text-gray-700'}">
            ${tInfo.is_imbalanced ? 'Imbalanced Classes' : 'Balanced Distribution'}
          </span>
        </div>
        <p class="text-xs text-gray-600">${tInfo.recommendation}</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mt-2">
          ${classHtml}
        </div>
      </div>
    `;
  } else {
    targetBody.innerHTML = `
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div class="p-3 rounded border border-gray-200 bg-gray-50/50">
          <div class="text-xs text-gray-500 font-medium">Target Feature</div>
          <div class="text-lg font-bold text-gray-900 mt-1">${tInfo.column}</div>
          <div class="text-xs text-gray-500 mt-0.5">Continuous Regression</div>
        </div>
        <div class="p-3 rounded border border-gray-200 bg-gray-50/50">
          <div class="text-xs text-gray-500 font-medium">Mean Value</div>
          <div class="text-lg font-bold text-gray-900 mt-1">${tInfo.mean}</div>
          <div class="text-xs text-gray-500 mt-0.5">Median: ${tInfo.median}</div>
        </div>
        <div class="p-3 rounded border border-gray-200 bg-gray-50/50">
          <div class="text-xs text-gray-500 font-medium">Range Spread</div>
          <div class="text-lg font-bold text-gray-900 mt-1">${tInfo.min} - ${tInfo.max}</div>
          <div class="text-xs text-gray-500 mt-0.5">Std Dev: ${tInfo.std}</div>
        </div>
        <div class="p-3 rounded border border-gray-200 bg-gray-50/50">
          <div class="text-xs text-gray-500 font-medium">Skewness</div>
          <div class="text-lg font-bold text-gray-900 mt-1">${tInfo.skew}</div>
          <div class="text-xs text-gray-500 mt-0.5">${Math.abs(tInfo.skew) > 1 ? 'Skewed Distribution' : 'Symmetric'}</div>
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
      <td class="font-medium text-gray-900">${o.column}</td>
      <td class="font-mono text-xs text-gray-700">${o.outlier_count}</td>
      <td class="font-mono text-xs text-gray-700 font-bold">${o.outlier_pct}%</td>
      <td class="text-gray-600 font-mono text-xs">${o.lower_bound}</td>
      <td class="text-gray-600 font-mono text-xs">${o.upper_bound}</td>
      <td><span class="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">${o.severity}</span></td>
      <td class="text-xs text-gray-600 font-sans">${treat}</td>
    `;
    outBody.appendChild(tr);
  });

  // 9. Feature Relationships
  const relBody = document.getElementById('featureRelBody');
  const pairs = inv.feature_relationships.top_correlated_pairs || [];
  if (pairs.length === 0) {
    relBody.innerHTML = `<div class="col-span-2 text-xs text-gray-500">Not enough numerical features for cross-correlation.</div>`;
  } else {
    let pairCardsHtml = pairs.slice(0, 6).map(p => `
      <div class="p-2.5 rounded border border-gray-200 bg-gray-50/50 flex items-center justify-between">
        <div>
          <div class="text-xs font-semibold text-gray-900">${p.feature_1} & ${p.feature_2}</div>
          <div class="text-[11px] text-gray-500">${Math.abs(p.correlation) > 0.7 ? 'Strong correlation' : 'Moderate correlation'}</div>
        </div>
        <div class="font-mono font-bold text-xs text-gray-900">${p.correlation > 0 ? '+' : ''}${p.correlation}</div>
      </div>
    `).join('');
    relBody.innerHTML = `
      <div class="space-y-2">
        <div class="text-xs font-semibold text-gray-700 uppercase tracking-wider">Top Correlated Pairs</div>
        <div class="space-y-2">${pairCardsHtml}</div>
      </div>
      <div class="p-3.5 rounded border border-gray-200 bg-gray-50/50 flex flex-col justify-between">
        <div>
          <div class="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Multicollinearity Guidance</div>
          <p class="text-xs text-gray-600 leading-relaxed mb-4">
            Features with correlation exceeding |0.80| induce multicollinearity in linear models. Consider dropping one of the collinear pairs.
          </p>
        </div>
        <button onclick="switchMainTab('visualizations')" class="w-full py-2 rounded bg-white hover:bg-gray-100 text-xs font-medium text-gray-800 border border-gray-300 transition">
          View Correlation Heatmap →
        </button>
      </div>
    `;
  }

  // 10. Data Quality & Leakage
  const qList = document.getElementById('qualityIssuesList');
  const issues = inv.data_quality_leakage.issues || [];
  if (issues.length === 0) {
    qList.innerHTML = `
      <div class="p-3 rounded border border-gray-200 bg-gray-50 text-xs text-gray-700 flex items-center space-x-2">
        <i data-lucide="check" class="w-4 h-4 text-gray-900"></i>
        <span>No critical quality issues detected. Dataset is clean and ready.</span>
      </div>
    `;
  } else {
    qList.innerHTML = issues.map(iss => {
      return `
        <div class="p-3 rounded border border-gray-200 bg-gray-50 flex items-start justify-between">
          <div>
            <div class="text-xs font-semibold text-gray-900">${iss.type} (${iss.column})</div>
            <p class="text-xs text-gray-600 mt-0.5">${iss.description}</p>
          </div>
          <span class="text-[11px] font-medium text-gray-700 bg-white border border-gray-200 px-2 py-0.5 rounded ml-3 shrink-0">${iss.severity}</span>
        </div>
      `;
    }).join('');
  }
}

// =========================================================
// PART 2: 10 VISUALIZATIONS RENDERERS (CLEAN PROFESSIONAL)
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

// 1. Missing Values Heatmap (Minimalist Canvas Grid)
function renderMissingHeatmap() {
  const canvas = document.getElementById('canvasMissingHeatmap');
  if (!globalData || !globalData.visualizations) return;
  const viz = globalData.visualizations.missing_heatmap;
  if (!canvas || !viz || !viz.matrix || viz.matrix.length === 0) return;

  const parent = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  const width = parent.clientWidth || parent.offsetWidth || 500;
  const height = parent.clientHeight || parent.offsetHeight || 240;

  // Set explicit canvas element style and coordinate size
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';

  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const numRows = viz.matrix.length;
  const numCols = viz.columns.length;
  const labelSpace = 24;
  const usableHeight = height - labelSpace;
  const cellWidth = width / numCols;
  const cellHeight = usableHeight / numRows;

  // Draw cells
  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      const isMissing = viz.matrix[r][c] === 1;
      ctx.fillStyle = isMissing ? '#111827' : '#e5e7eb';
      ctx.fillRect(
        c * cellWidth,
        r * cellHeight,
        Math.max(1, cellWidth - 1),
        Math.max(1, cellHeight - 1)
      );
    }
  }

  // Draw column labels
  ctx.fillStyle = '#4b5563';
  ctx.font = '10px Inter, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  for (let c = 0; c < numCols; c++) {
    const rawName = viz.columns[c] || '';
    const name = rawName.length > 8 ? rawName.slice(0, 7) + '…' : rawName;
    ctx.fillText(name, c * cellWidth + 2, usableHeight + 12);
  }

  ctx.restore();

  const missingSum = (viz.missing_per_col || []).reduce((a, b) => a + b, 0);
  const summaryEl = document.getElementById('missingHeatmapSummary');
  if (summaryEl) {
    summaryEl.textContent = `${missingSum} missing cells in matrix`;
  }
}

// 2. Histograms (Crisp Professional Bar)
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
        backgroundColor: '#374151',
        borderRadius: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: SAAS_COLORS.text, font: { size: 9 } }, grid: { display: false } },
        y: { ticks: { color: SAAS_COLORS.text, font: { size: 10 } }, grid: { color: SAAS_COLORS.grid } }
      }
    }
  });

  document.getElementById('histStatsFooter').innerHTML = `
    <span>Mean: <strong class="text-gray-900">${hist.mean}</strong></span>
    <span>Median: <strong class="text-gray-900">${hist.median}</strong></span>
  `;
}

// 3. Box Plots (Quartiles & Bounds)
function renderBoxplotChart() {
  const select = document.getElementById('boxFeatureSelect');
  if (!select || !select.value) return;
  const feat = select.value;
  const b = globalData.visualizations.boxplots[feat];
  if (!b) return;

  getOrCreateChart('canvasBoxplot', {
    type: 'bar',
    data: {
      labels: ['Lower Bound', 'Q1 (25%)', 'Median', 'Q3 (75%)', 'Upper Bound'],
      datasets: [{
        label: `${feat}`,
        data: [b.lower_whisker, b.q1, b.median, b.q3, b.upper_whisker],
        backgroundColor: '#4b5563',
        borderRadius: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: SAAS_COLORS.text, font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: SAAS_COLORS.text, font: { size: 10 } }, grid: { color: SAAS_COLORS.grid } }
      }
    }
  });

  document.getElementById('boxStatsFooter').innerHTML = `
    <span>IQR: <strong class="text-gray-900">${(b.q3 - b.q1).toFixed(2)}</strong></span>
    <span>Outliers: <strong class="text-gray-900">${b.outliers.length}</strong></span>
  `;
}

// 4. Count Plots (Discrete Categories)
function renderCountPlotChart() {
  const select = document.getElementById('countFeatureSelect');
  if (!select || !select.value) return;
  const feat = select.value;
  const c = globalData.visualizations.countplots[feat];
  if (!c) return;

  getOrCreateChart('canvasCountplot', {
    type: 'bar',
    data: {
      labels: c.categories,
      datasets: [{
        label: feat,
        data: c.counts,
        backgroundColor: '#1f2937',
        borderRadius: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: SAAS_COLORS.text, font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: SAAS_COLORS.text, font: { size: 10 } }, grid: { color: SAAS_COLORS.grid } }
      }
    }
  });

  const total = c.counts.reduce((a, b) => a + b, 0);
  document.getElementById('countPlotFooter').innerHTML = `
    <span>Categories: <strong class="text-gray-900">${c.categories.length}</strong></span>
    <span>Total: <strong class="text-gray-900">${total}</strong></span>
  `;
}

// 5. Correlation Heatmap (Monochrome / Slate Shades)
function renderCorrelationHeatmap() {
  const container = document.getElementById('corrHeatmapContainer');
  const h = globalData.visualizations.correlation_heatmap;
  if (!container) return;
  if (!h || !h.columns || h.columns.length === 0) {
    container.innerHTML = `<div class="text-xs text-gray-500 py-8">No numerical features for correlation matrix.</div>`;
    return;
  }

  const cols = h.columns;
  const n = cols.length;

  let tableHtml = `<div class="inline-block overflow-hidden"><table class="border-collapse text-xs font-mono">`;
  
  tableHtml += `<tr><th></th>`;
  cols.forEach(c => {
    tableHtml += `<th class="px-2.5 py-1.5 text-gray-600 font-medium text-center truncate max-w-[85px]">${c.slice(0, 8)}</th>`;
  });
  tableHtml += `</tr>`;

  for (let r = 0; r < n; r++) {
    tableHtml += `<tr><th class="px-2.5 py-1.5 text-gray-600 font-medium text-right truncate max-w-[90px]">${cols[r].slice(0, 8)}</th>`;
    for (let c = 0; c < n; c++) {
      const val = h.matrix[r][c];
      const bg = getSaaSCorrColor(val);
      const txtColor = Math.abs(val) > 0.45 ? '#ffffff' : '#111827';
      tableHtml += `<td class="p-2 text-center font-medium rounded-xs" style="background-color: ${bg}; color: ${txtColor};" title="${cols[r]} vs ${cols[c]}: ${val}">${val.toFixed(2)}</td>`;
    }
    tableHtml += `</tr>`;
  }
  tableHtml += `</table></div>`;
  container.innerHTML = tableHtml;
}

function getSaaSCorrColor(val) {
  if (val === 1.0) return '#111827';
  if (val > 0) {
    return `rgba(31, 41, 55, ${Math.max(0.06, val * 0.9)})`;
  } else {
    return `rgba(185, 28, 28, ${Math.max(0.06, Math.abs(val) * 0.85)})`;
  }
}

// 6. Scatter Plots
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
        backgroundColor: '#1f2937',
        pointRadius: 3,
        pointHoverRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: p.x_col, color: SAAS_COLORS.text, font: { size: 10 } }, ticks: { color: SAAS_COLORS.text }, grid: { color: SAAS_COLORS.grid } },
        y: { title: { display: true, text: p.y_col, color: SAAS_COLORS.text, font: { size: 10 } }, ticks: { color: SAAS_COLORS.text }, grid: { color: SAAS_COLORS.grid } }
      }
    }
  });

  document.getElementById('scatterFooter').innerHTML = `
    <span>Pearson (r): <strong class="text-gray-900">${p.correlation}</strong></span>
    <span>Observations: <strong class="text-gray-900">${p.points.length}</strong></span>
  `;
}

// 7. Target Distribution Plot
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
          backgroundColor: ['#111827', '#4b5563', '#9ca3af', '#d1d5db'],
          borderWidth: 1,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: '#374151', font: { size: 11 } } }
        }
      }
    });

    document.getElementById('targetPlotFooter').innerHTML = `
      <span>Balance: <strong class="text-gray-900">${tInfo.is_imbalanced ? 'Imbalanced' : 'Balanced'}</strong></span>
      <span>Classes: <strong class="text-gray-900">${tInfo.unique_classes}</strong></span>
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
          backgroundColor: '#374151',
          borderRadius: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: SAAS_COLORS.text, font: { size: 9 } }, grid: { display: false } },
          y: { ticks: { color: SAAS_COLORS.text }, grid: { color: SAAS_COLORS.grid } }
        }
      }
    });

    document.getElementById('targetPlotFooter').innerHTML = `
      <span>Mean: <strong class="text-gray-900">${tInfo.mean}</strong></span>
      <span>Skew: <strong class="text-gray-900">${tInfo.skew}</strong></span>
    `;
  }
}

// 8. Pair Plot Matrix
function renderPairplotGrid() {
  const container = document.getElementById('pairplotGridContainer');
  const pp = globalData.visualizations.pairplot;
  if (!container) return;
  if (!pp || !pp.columns || pp.columns.length < 2) {
    container.innerHTML = `<div class="text-xs text-gray-500 py-6 text-center">Pair plot requires at least two numerical features.</div>`;
    return;
  }

  const cols = pp.columns;
  const n = cols.length;
  
  let gridHtml = `<div class="grid" style="grid-template-columns: repeat(${n}, minmax(130px, 1fr)); gap: 6px;">`;
  
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const cid = `pair_c_${r}_${c}`;
      gridHtml += `
        <div class="h-28 rounded bg-white border border-gray-200 p-1 flex flex-col justify-between">
          <div class="text-[9px] font-mono text-gray-500 truncate">${cols[r].slice(0,6)} / ${cols[c].slice(0,6)}</div>
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
                backgroundColor: '#6b7280',
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
                backgroundColor: '#1f2937',
                pointRadius: 2
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

// 9. Feature vs Target Plots
function renderFeatVsTargetChart() {
  const select = document.getElementById('featVsTargetSelect');
  if (!select || !select.value) return;
  const feat = select.value;
  const fvt = globalData.visualizations.feature_vs_target[feat];
  if (!fvt) return;

  if (fvt.type === "grouped_box") {
    const labels = fvt.data.map(d => `Class ${d.class}`);
    const medians = fvt.data.map(d => d.median);

    getOrCreateChart('canvasFeatVsTarget', {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: `${feat} Median`,
          data: medians,
          backgroundColor: '#374151',
          borderRadius: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: SAAS_COLORS.text, font: { size: 10 } }, grid: { display: false } },
          y: { ticks: { color: SAAS_COLORS.text, font: { size: 10 } }, grid: { color: SAAS_COLORS.grid } }
        }
      }
    });

    document.getElementById('featVsTargetFooter').innerHTML = `
      <span>Feature: <strong class="text-gray-900">${feat}</strong></span>
      <span>Distribution grouped across target classes</span>
    `;
  } else {
    getOrCreateChart('canvasFeatVsTarget', {
      type: 'scatter',
      data: {
        datasets: [{
          label: `${feat} vs ${fvt.target}`,
          data: fvt.points,
          backgroundColor: '#1f2937',
          pointRadius: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { title: { display: true, text: feat, color: SAAS_COLORS.text }, ticks: { color: SAAS_COLORS.text }, grid: { color: SAAS_COLORS.grid } },
          y: { title: { display: true, text: fvt.target, color: SAAS_COLORS.text }, ticks: { color: SAAS_COLORS.text }, grid: { color: SAAS_COLORS.grid } }
        }
      }
    });

    document.getElementById('featVsTargetFooter').innerHTML = `
      <span>Relationship: <strong class="text-gray-900">${feat} vs ${fvt.target}</strong></span>
      <span>Continuous bivariate distribution</span>
    `;
  }
}

// 10. Time-Series Plot
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
        borderColor: '#111827',
        backgroundColor: 'rgba(17, 24, 39, 0.04)',
        borderWidth: 1.5,
        fill: true,
        tension: 0.1,
        pointRadius: 1,
        pointHoverRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: SAAS_COLORS.text, maxTicksLimit: 7 }, grid: { display: false } },
        y: { ticks: { color: SAAS_COLORS.text }, grid: { color: SAAS_COLORS.grid } }
      }
    }
  });

  document.getElementById('tsFooter').innerHTML = `
    <span>Observations: <strong class="text-gray-900">${ts.series.length}</strong></span>
    <span>Feature: <strong class="text-gray-900">${ts.value_column}</strong></span>
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
      return `<td class="font-mono text-xs whitespace-nowrap ${isNull ? 'text-red-700 italic font-semibold' : 'text-gray-800'}">${isNull ? 'null' : val}</td>`;
    }).join('') + '</tr>';
  }).join('');
}

function downloadCleanReport() {
  if (!globalData) return;
  const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(globalData, null, 2));
  const dlAnchorElem = document.createElement('a');
  dlAnchorElem.setAttribute("href", jsonStr);
  dlAnchorElem.setAttribute("download", `qubrix_audit_${Date.now()}.json`);
  dlAnchorElem.click();
}

// =========================================================
// MULTI-FEATURE FULL-PAGE ROUTING & NAVIGATION
// =========================================================
function navigateToFeaturePage(featureId) {
  if (!requireAuth()) return;

  const heroState = document.getElementById('heroUploadState');
  const dashboardState = document.getElementById('dashboardState');
  const edaSection = document.getElementById('fullPageEdaSection');
  const synthSection = document.getElementById('fullPageSynthesizerSection');
  const readinessSection = document.getElementById('fullPageReadinessSection');
  const preprocessSection = document.getElementById('fullPagePreprocessSection');
  const preprocessResultsSection = document.getElementById('fullPagePreprocessResultsSection');
  const profileSection = document.getElementById('fullPageProfileSection');

  // Hide landing hero and active analysis dashboard
  if (heroState) heroState.classList.add('hidden');
  if (dashboardState) dashboardState.classList.add('hidden');

  // Hide all full-page sections first
  if (edaSection) edaSection.classList.add('hidden');
  if (synthSection) synthSection.classList.add('hidden');
  if (readinessSection) readinessSection.classList.add('hidden');
  if (preprocessSection) preprocessSection.classList.add('hidden');
  if (preprocessResultsSection) preprocessResultsSection.classList.add('hidden');
  if (profileSection) profileSection.classList.add('hidden');

  if (featureId === 'eda') {
    if (edaSection) edaSection.classList.remove('hidden');
  } else if (featureId === 'synthesizer') {
    if (synthSection) synthSection.classList.remove('hidden');
  } else if (featureId === 'preprocess' || featureId === 'readiness') {
    if (preprocessSection) preprocessSection.classList.remove('hidden');
    else if (readinessSection) readinessSection.classList.remove('hidden');
  } else if (featureId === 'preprocess_results') {
    if (preprocessResultsSection) preprocessResultsSection.classList.remove('hidden');
  } else if (featureId === 'profile') {
    if (profileSection) profileSection.classList.remove('hidden');
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
  lucide.createIcons();
}

// Return to clean Home landing view from any full page
function returnToHome() {
  const dashboardState = document.getElementById('dashboardState');
  const heroUploadState = document.getElementById('heroUploadState');
  const activeFileBadge = document.getElementById('activeFileBadge');
  const fileInput = document.getElementById('fileUploadInput');
  const edaSection = document.getElementById('fullPageEdaSection');
  const synthSection = document.getElementById('fullPageSynthesizerSection');
  const readinessSection = document.getElementById('fullPageReadinessSection');
  const preprocessSection = document.getElementById('fullPagePreprocessSection');
  const preprocessResultsSection = document.getElementById('fullPagePreprocessResultsSection');
  const profileSection = document.getElementById('fullPageProfileSection');

  if (dashboardState) dashboardState.classList.add('hidden');
  if (edaSection) edaSection.classList.add('hidden');
  if (synthSection) synthSection.classList.add('hidden');
  if (readinessSection) readinessSection.classList.add('hidden');
  if (preprocessSection) preprocessSection.classList.add('hidden');
  if (preprocessResultsSection) preprocessResultsSection.classList.add('hidden');
  if (profileSection) profileSection.classList.add('hidden');

  if (heroUploadState) heroUploadState.classList.remove('hidden');
  if (activeFileBadge) {
    activeFileBadge.classList.add('hidden');
    activeFileBadge.classList.remove('flex');
  }
  if (fileInput) fileInput.value = '';

  window.scrollTo({ top: 0, behavior: 'smooth' });
  lucide.createIcons();
}

// =========================================================
// MULTI-FILE SYNTHESIS WORKFLOW
// =========================================================
let currentSynthesizedResult = null;
let fullSelectedFiles = [];

function setFullSynthPrompt(text) {
  if (!requireAuth()) return;
  const promptEl = document.getElementById('fullSynthPrompt');
  if (promptEl) {
    promptEl.value = text;
    promptEl.focus();
  }
}

function handleFullSynthFilesSelected(event) {
  if (!requireAuth()) {
    event.target.value = '';
    return;
  }
  const input = event.target;
  if (!input.files || input.files.length === 0) return;

  fullSelectedFiles = Array.from(input.files);
  renderSelectedFilesList();
}

function renderSelectedFilesList() {
  const container = document.getElementById('selectedFilesChips');
  const display = document.getElementById('fullSynthFileDisplay');
  if (!container) return;

  if (fullSelectedFiles.length === 0) {
    container.innerHTML = '';
    if (display) display.textContent = "Drag and drop files here, or click to browse";
    return;
  }

  if (display) {
    display.innerHTML = `<span class="font-bold text-gray-900">${fullSelectedFiles.length} file(s) selected</span> <span class="text-xs text-gray-500 font-normal">(Click or drag more to replace)</span>`;
  }

  container.innerHTML = fullSelectedFiles.map((file, idx) => {
    const ext = file.name.split('.').pop().toUpperCase();
    const sizeKb = (file.size / 1024).toFixed(1);
    return `
      <div class="inline-flex items-center space-x-2 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-xs">
        <span class="font-bold text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-800">${ext}</span>
        <span class="font-medium text-gray-900 max-w-[150px] truncate">${file.name}</span>
        <span class="text-gray-400 font-mono text-[10px]">(${sizeKb} KB)</span>
        <button type="button" onclick="removeSelectedFile(${idx})" class="text-gray-400 hover:text-red-600 transition ml-1">
          <i data-lucide="x" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    `;
  }).join('');

  lucide.createIcons();
}

function removeSelectedFile(index) {
  fullSelectedFiles.splice(index, 1);
  renderSelectedFilesList();
}

async function executeFullSynthesis() {
  if (!requireAuth()) return;
  const promptInput = document.getElementById('fullSynthPrompt');
  const autoVizInput = document.getElementById('fullSynthAutoViz');
  const errBox = document.getElementById('fullSynthErrorMsg');
  const submitBtn = document.getElementById('fullSynthBtn');
  const submitBtnText = document.getElementById('fullSynthBtnText');
  const successBox = document.getElementById('fullSynthSuccessBox');

  if (fullSelectedFiles.length === 0) {
    errBox.textContent = "Please select at least one file (PDF, JSON, Excel, TXT, or CSV) to synthesize.";
    errBox.classList.remove('hidden');
    return;
  }

  const prompt = promptInput ? promptInput.value.trim() : "";
  const autoViz = autoVizInput ? autoVizInput.checked : true;

  errBox.classList.add('hidden');
  if (successBox) successBox.classList.add('hidden');

  submitBtn.disabled = true;
  submitBtnText.textContent = `Processing & Merging ${fullSelectedFiles.length} File(s)...`;

  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadingStatusText = document.getElementById('loadingStatusText');
  if (loadingOverlay) {
    loadingOverlay.classList.remove('hidden');
    loadingOverlay.classList.add('flex');
    if (loadingStatusText) loadingStatusText.textContent = `Structuring & combining ${fullSelectedFiles.length} file(s)...`;
  }

  const formData = new FormData();
  fullSelectedFiles.forEach(f => {
    formData.append('files', f);
  });
  formData.append('prompt', prompt);
  formData.append('auto_visualize', autoViz);

  try {
    const res = await fetch('/api/synthesize', {
      method: 'POST',
      body: formData
    });

    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.detail || "Failed to synthesize dataset.");
    }

    currentSynthesizedResult = result;

    if (successBox) {
      document.getElementById('fullSynthSummaryText').textContent = 
        `Synthesized ${result.shape.rows} rows × ${result.shape.columns} columns from ${result.file_count || fullSelectedFiles.length} file(s). Output: ${result.filename}`;
      successBox.classList.remove('hidden');
      lucide.createIcons();
    }

    // If auto-visualize is checked, immediately launch into 10 Visualizations & Audits!
    if (autoViz && result.data) {
      renderAppWithData(result.filename, result.data);
    }
  } catch (err) {
    console.error("Multi-file synthesis error:", err);
    if (errBox) {
      errBox.textContent = err.message || "Synthesis failed. Please review your file formats.";
      errBox.classList.remove('hidden');
    }
  } finally {
    submitBtn.disabled = false;
    submitBtnText.textContent = "Synthesize & Combine Files";
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
      loadingOverlay.classList.remove('flex');
    }
  }
}

function downloadSynthesizedCSV() {
  if (!currentSynthesizedResult || !currentSynthesizedResult.csv_data) return;
  const blob = new Blob([currentSynthesizedResult.csv_data], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const dlAnchor = document.createElement('a');
  dlAnchor.href = url;
  dlAnchor.download = currentSynthesizedResult.filename || 'synthesized_dataset.csv';
  dlAnchor.click();
  URL.revokeObjectURL(url);
}

function openSynthesizedInDashboard() {
  if (!currentSynthesizedResult || !currentSynthesizedResult.data) return;
  renderAppWithData(currentSynthesizedResult.filename, currentSynthesizedResult.data);
}

// =========================================================
// FEATURE 3: AUTONOMOUS PREPROCESSOR & ML ADVISOR WORKFLOW
// =========================================================
let currentPreprocessedResult = null;
let preprocessSelectedFile = null;

function handlePreprocessFileSelected(event) {
  if (!requireAuth()) {
    event.target.value = '';
    return;
  }
  const input = event.target;
  if (!input.files || input.files.length === 0) return;

  preprocessSelectedFile = input.files[0];
  const display = document.getElementById('preprocessFileDisplay');
  if (display) {
    const sizeKb = (preprocessSelectedFile.size / 1024).toFixed(1);
    display.innerHTML = `
      <span class="font-bold text-gray-900">${preprocessSelectedFile.name}</span>
      <span class="text-xs text-gray-500 font-mono">(${sizeKb} KB)</span>
      <span class="text-xs text-green-600 font-semibold block mt-1">Ready for automated preprocessing & ML analysis</span>
    `;
  }
}

async function executePreprocessDemo(sampleName) {
  if (!requireAuth()) return;
  navigateToFeaturePage('preprocess');

  const display = document.getElementById('preprocessFileDisplay');
  if (display) {
    const label = sampleName === 'customer_churn' ? 'Customer Churn (Classification Demo)' : 'California Housing (Regression Demo)';
    display.innerHTML = `
      <span class="font-bold text-gray-900">${label}</span>
      <span class="text-xs text-blue-600 font-semibold block mt-1">Demo dataset loaded & ready</span>
    `;
  }
  preprocessSelectedFile = null;

  const targetInput = document.getElementById('preprocessTargetInput');
  if (targetInput) {
    targetInput.value = sampleName === 'customer_churn' ? 'Churn' : 'median_house_value';
  }

  await executePreprocessing(sampleName);
}

async function executePreprocessing(sampleName = null) {
  if (!requireAuth()) return;

  const targetInput = document.getElementById('preprocessTargetInput');
  const targetCol = targetInput ? targetInput.value.trim() : "";
  const errBox = document.getElementById('preprocessErrorMsg');
  const submitBtn = document.getElementById('preprocessSubmitBtn');
  const submitBtnText = document.getElementById('preprocessSubmitBtnText');
  const resultsContainer = document.getElementById('preprocessResultsContainer');

  if (!sampleName && !preprocessSelectedFile) {
    if (errBox) {
      errBox.textContent = "Please upload a CSV dataset or select a demo dataset to preprocess.";
      errBox.classList.remove('hidden');
    }
    return;
  }

  if (errBox) errBox.classList.add('hidden');
  if (resultsContainer) resultsContainer.classList.add('hidden');

  if (submitBtn) submitBtn.disabled = true;
  if (submitBtnText) submitBtnText.textContent = "Cleaning data & recommending models...";

  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadingStatusText = document.getElementById('loadingStatusText');
  if (loadingOverlay) {
    loadingOverlay.classList.remove('hidden');
    loadingOverlay.classList.add('flex');
    if (loadingStatusText) loadingStatusText.textContent = "Autonomous Data Scientist: Cleaning nulls, capping outliers & tailoring ML models...";
  }

  const formData = new FormData();
  if (sampleName) {
    formData.append('use_sample', sampleName);
  } else if (preprocessSelectedFile) {
    formData.append('file', preprocessSelectedFile);
  }

  if (targetCol) {
    formData.append('target_col', targetCol);
  }

  try {
    const res = await fetch('/api/preprocess', {
      method: 'POST',
      body: formData
    });

    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.detail || "Failed to preprocess dataset.");
    }

    currentPreprocessedResult = result;
    renderPreprocessResults(result);

  } catch (err) {
    console.error("Auto-preprocessing error:", err);
    if (errBox) {
      errBox.textContent = err.message || "Automated preprocessing encountered an issue.";
      errBox.classList.remove('hidden');
    }
  } finally {
    if (submitBtn) submitBtn.disabled = false;
    if (submitBtnText) submitBtnText.textContent = "Clean Dataset & Generate ML Strategy";
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
      loadingOverlay.classList.remove('flex');
    }
  }
}

function renderPreprocessResults(result) {
  const container = document.getElementById('preprocessResultsContainer');
  if (!container) return;

  // Header info
  const filenameEl = document.getElementById('preprocessResultFilename');
  const subtitleEl = document.getElementById('preprocessResultSubtitle');
  if (filenameEl) filenameEl.textContent = result.cleaned_filename || "model_ready_dataset.csv";
  if (subtitleEl) {
    const targetText = result.target_col ? ` | Target: '${result.target_col}'` : "";
    subtitleEl.textContent = `Task: ${result.task_detail || result.ml_task}${targetText}`;
  }

  // Before vs After Metrics
  const before = result.audit_before || {};
  const after = result.audit_after || {};

  const beforeScore = before.health_score || 0;
  const afterScore = after.health_score || 100;
  const scoreDiff = afterScore - beforeScore;

  const scoreAfterEl = document.getElementById('metricScoreAfter');
  const scoreChangeEl = document.getElementById('metricScoreChange');
  const scoreBeforeEl = document.getElementById('metricScoreBefore');
  if (scoreAfterEl) scoreAfterEl.textContent = `${afterScore}/100`;
  if (scoreBeforeEl) scoreBeforeEl.textContent = `Was ${beforeScore}/100`;
  if (scoreChangeEl) {
    scoreChangeEl.textContent = scoreDiff >= 0 ? `+${scoreDiff}%` : `${scoreDiff}%`;
    scoreChangeEl.className = "text-xs font-semibold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded";
  }

  const nullsAfterEl = document.getElementById('metricNullsAfter');
  const nullsBeforeEl = document.getElementById('metricNullsBefore');
  if (nullsAfterEl) nullsAfterEl.textContent = `${after.total_nulls || 0} (${after.null_pct || 0}%)`;
  if (nullsBeforeEl) nullsBeforeEl.textContent = `Was ${before.total_nulls || 0} (${before.null_pct || 0}%)`;

  const outliersEl = document.getElementById('metricOutliersCapped');
  if (outliersEl) outliersEl.textContent = `${after.outliers_capped || 0} Capped`;

  const shapeAfterEl = document.getElementById('metricShapeAfter');
  const colsDroppedEl = document.getElementById('metricColsDropped');
  if (shapeAfterEl) shapeAfterEl.textContent = `${(after.rows || 0).toLocaleString()} × ${(after.columns || 0)}`;
  if (colsDroppedEl) {
    const dropped = after.columns_dropped || 0;
    colsDroppedEl.textContent = dropped === 1 ? "1 non-informative column removed" : `${dropped} non-informative columns removed`;
  }

  // Data Engineering Actions Log
  const actionsContainer = document.getElementById('preprocessActionsList');
  const actionsCountBadge = document.getElementById('actionsCountBadge');
  const actions = result.actions_taken || [];
  if (actionsCountBadge) actionsCountBadge.textContent = `${actions.length} transformations applied`;
  if (actionsContainer) {
    if (actions.length === 0) {
      actionsContainer.innerHTML = `
        <div class="text-xs text-gray-500 p-3 bg-gray-50 rounded-lg">Dataset was already fully clean with zero missing values or outliers.</div>
      `;
    } else {
      actionsContainer.innerHTML = actions.map(action => `
        <div class="flex items-start space-x-2 text-xs text-gray-700 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
          <i data-lucide="check" class="w-4 h-4 text-gray-600 shrink-0 mt-0.5"></i>
          <span class="leading-relaxed">${action}</span>
        </div>
      `).join('');
    }
  }

  // Machine Learning Model Recommendations
  const recs = result.ml_recommendations || {};
  const taskBadge = document.getElementById('mlTaskBadge');
  if (taskBadge) taskBadge.textContent = recs.task_type || result.task_detail || "Machine Learning";

  const cardsGrid = document.getElementById('mlModelCardsGrid');
  if (cardsGrid) {
    const primary = recs.primary_model || { name: "Gradient Boosted Trees", type: "Ensemble", rationale: "Standard top performer on tabular features." };
    const baseline = recs.baseline_model || { name: "Linear Benchmark", type: "Linear Model", rationale: "Fast reference point for model iteration." };
    const interp = recs.interpretable_model || { name: "Decision Tree / EBM", type: "Rule-Based", rationale: "Transparent splits for regulatory interpretability." };

    let primaryHyperHtml = '';
    if (primary.hyperparameters) {
      if (typeof primary.hyperparameters === 'string') {
        primaryHyperHtml = primary.hyperparameters.split(',').map(item => `
          <span class="text-[10px] bg-white border border-blue-200 text-blue-900 px-1.5 py-0.5 rounded font-mono">${item.trim()}</span>
        `).join('');
      } else if (typeof primary.hyperparameters === 'object') {
        primaryHyperHtml = Object.entries(primary.hyperparameters).map(([k, v]) => `
          <span class="text-[10px] bg-white border border-blue-200 text-blue-900 px-1.5 py-0.5 rounded font-mono">${k}: ${v}</span>
        `).join('');
      }
    }

    cardsGrid.innerHTML = `
      <!-- 1. Primary Model Card -->
      <div class="border border-blue-200 bg-blue-50/20 rounded-xl p-5 flex flex-col justify-between shadow-2xs">
        <div>
          <div class="flex items-center justify-between mb-3">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 uppercase tracking-wider">Top Recommendation</span>
            <span class="text-[11px] text-gray-500 font-mono">${primary.type || 'Ensemble'}</span>
          </div>
          <h5 class="text-base font-bold text-gray-900 mb-2">${primary.name}</h5>
          <p class="text-xs text-gray-600 leading-relaxed mb-4">${primary.rationale || primary.why || ''}</p>
          ${primary.strengths && primary.strengths.length > 0 ? `
            <div class="mb-3">
              <span class="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Key Strengths</span>
              <ul class="text-[11px] text-gray-600 space-y-1 list-disc list-inside">
                ${primary.strengths.map(s => `<li>${s}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
        ${primaryHyperHtml ? `
          <div class="pt-3 border-t border-blue-100 mt-2">
            <span class="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1.5">Suggested Hyperparameters</span>
            <div class="flex flex-wrap gap-1">
              ${primaryHyperHtml}
            </div>
          </div>
        ` : ''}
      </div>

      <!-- 2. Baseline Model Card -->
      <div class="border border-gray-200 bg-gray-50/40 rounded-xl p-5 flex flex-col justify-between shadow-2xs">
        <div>
          <div class="flex items-center justify-between mb-3">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-800 uppercase tracking-wider">Fast Baseline</span>
            <span class="text-[11px] text-gray-500 font-mono">${baseline.type || 'Linear'}</span>
          </div>
          <h5 class="text-base font-bold text-gray-900 mb-2">${baseline.name}</h5>
          <p class="text-xs text-gray-600 leading-relaxed mb-4">${baseline.rationale || baseline.why || ''}</p>
        </div>
        <div class="pt-3 border-t border-gray-200 mt-2 text-[11px] text-gray-500">
          Ideal for fast iteration benchmark and latency-sensitive deployments.
        </div>
      </div>

      <!-- 3. Interpretable Model Card -->
      <div class="border border-purple-200 bg-purple-50/20 rounded-xl p-5 flex flex-col justify-between shadow-2xs">
        <div>
          <div class="flex items-center justify-between mb-3">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 uppercase tracking-wider">Explainable</span>
            <span class="text-[11px] text-gray-500 font-mono">${interp.type || 'Rule-Based'}</span>
          </div>
          <h5 class="text-base font-bold text-gray-900 mb-2">${interp.name}</h5>
          <p class="text-xs text-gray-600 leading-relaxed mb-4">${interp.rationale || interp.why || ''}</p>
        </div>
        <div class="pt-3 border-t border-purple-100 mt-2 text-[11px] text-gray-500">
          Provides feature attributions and transparent decision boundaries for stakeholders.
        </div>
      </div>
    `;
  }

  // Validation strategy & Metrics
  const valStrategyEl = document.getElementById('mlValidationStrategy');
  if (valStrategyEl) {
    valStrategyEl.textContent = recs.validation_strategy || "5-Fold Stratified K-Fold Cross Validation";
  }

  const metricsContainer = document.getElementById('mlRecommendedMetrics');
  if (metricsContainer) {
    const metrics = recs.recommended_metrics || ["Accuracy", "ROC-AUC", "F1-Score"];
    metricsContainer.innerHTML = metrics.map(m => {
      const label = (typeof m === 'object' && m && m.metric) ? m.metric : String(m);
      const titleAttr = (typeof m === 'object' && m && m.purpose) ? ` title="${m.purpose}"` : '';
      return `<span class="text-[11px] font-semibold bg-white border border-gray-200 text-gray-700 px-2 py-0.5 rounded-md font-mono"${titleAttr}>${label}</span>`;
    }).join('');
  }

  // Feature tips
  const tipsContainer = document.getElementById('mlFeatureTips');
  if (tipsContainer) {
    const tips = recs.feature_engineering_tips || [
      "Dataset has been fully imputed and Tukey outlier capped.",
      "Check correlation matrix in EDA Visualizer to prune collinear pairs.",
      "Consider Target Encoding or Frequency Encoding for remaining high-cardinality nominals."
    ];
    tipsContainer.innerHTML = tips.map(t => `<li>${t}</li>`).join('');
  }

  // Hide all other screens and display the dedicated full-screen results page
  const heroState = document.getElementById('heroUploadState');
  const edaSection = document.getElementById('fullPageEdaSection');
  const synthSection = document.getElementById('fullPageSynthesizerSection');
  const preprocessSection = document.getElementById('fullPagePreprocessSection');
  const profileSection = document.getElementById('fullPageProfileSection');
  const dashboardState = document.getElementById('dashboardState');
  const resultsSection = document.getElementById('fullPagePreprocessResultsSection');

  if (heroState) heroState.classList.add('hidden');
  if (edaSection) edaSection.classList.add('hidden');
  if (synthSection) synthSection.classList.add('hidden');
  if (preprocessSection) preprocessSection.classList.add('hidden');
  if (profileSection) profileSection.classList.add('hidden');
  if (dashboardState) dashboardState.classList.add('hidden');

  if (resultsSection) resultsSection.classList.remove('hidden');
  if (container) container.classList.remove('hidden');

  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (window.lucide) lucide.createIcons();
}

function downloadPreprocessedCSV() {
  if (!currentPreprocessedResult || !currentPreprocessedResult.csv_data) return;
  const blob = new Blob([currentPreprocessedResult.csv_data], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const dlAnchor = document.createElement('a');
  dlAnchor.href = url;
  dlAnchor.download = currentPreprocessedResult.cleaned_filename || 'model_ready_dataset.csv';
  dlAnchor.click();
  URL.revokeObjectURL(url);
}

function openPreprocessedInVisualizer() {
  if (!currentPreprocessedResult || !currentPreprocessedResult.eda_data) return;
  renderAppWithData(currentPreprocessedResult.cleaned_filename, currentPreprocessedResult.eda_data);
}

function resetPreprocessView() {
  preprocessSelectedFile = null;
  currentPreprocessedResult = null;
  const fileInput = document.getElementById('preprocessFileInput');
  if (fileInput) fileInput.value = '';
  const display = document.getElementById('preprocessFileDisplay');
  if (display) display.textContent = "Drag and drop raw CSV here, or click to browse";
  const targetInput = document.getElementById('preprocessTargetInput');
  if (targetInput) targetInput.value = '';
  const errBox = document.getElementById('preprocessErrorMsg');
  if (errBox) errBox.classList.add('hidden');
  navigateToFeaturePage('preprocess');
}


