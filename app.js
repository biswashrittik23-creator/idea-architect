const horizon = document.querySelector('#horizon');
const horizonValue = document.querySelector('#horizonValue');
const riskValue = document.querySelector('#riskValue');
const riskMeter = document.querySelector('#riskMeter');
const confidenceValue = document.querySelector('#confidenceValue');
const confidenceBar = document.querySelector('#confidenceBar');
const riskMessage = document.querySelector('#riskMessage');
const confidenceCopy = document.querySelector('#confidenceCopy');
const toast = document.querySelector('#toast');
const thresholds = document.querySelectorAll('.threshold-btn');
const cityInput = document.querySelector('#city');
const citySubmit = document.querySelector('#citySubmit');
const feedStatus = document.querySelector('#feedStatus');
const feedCopy = document.querySelector('#feedCopy');
const lastRun = document.querySelector('#lastRun');

const baseRisk = 68;
const baseConfidence = 61;
let currentLocation = { name: 'New Delhi, India', latitude: 28.6139, longitude: 77.209 };
let liveEnsemble = null;

function setFeedState(isLive, message) {
  feedStatus.textContent = isLive ? 'Live data feed' : 'Demo data fallback';
  feedCopy.innerHTML = isLive ? `ECMWF ENS · ${currentLocation.name}<br>${message}` : 'ECMWF ENS · simulated values<br>Network unavailable';
  lastRun.textContent = isLive ? message : 'offline';
}

async function fetchLiveEnsemble() {
  try {
    const city = cityInput.value.trim();
    if (!city) throw new Error('Enter a city first');
    const geocodeResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
    if (!geocodeResponse.ok) throw new Error(`Geocoding HTTP ${geocodeResponse.status}`);
    const geocode = await geocodeResponse.json();
    if (!geocode.results?.length) throw new Error(`City not found: ${city}`);
    const match = geocode.results[0];
    currentLocation = { name: `${match.name}${match.country ? `, ${match.country}` : ''}`, latitude: match.latitude, longitude: match.longitude };
    const url = `https://ensemble-api.open-meteo.com/v1/ensemble?latitude=${currentLocation.latitude}&longitude=${currentLocation.longitude}&daily=temperature_2m_mean&models=ecmwf_ifs025&forecast_days=16&timezone=UTC`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    liveEnsemble = await response.json();
    const runTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
    setFeedState(true, `${runTime} IST`);
  } catch (error) {
    liveEnsemble = null;
    setFeedState(false, error.message);
  }
  updateAnalysis();
}

function getLiveMetrics(days) {
  if (!liveEnsemble?.daily) return null;
  const memberKeys = Object.keys(liveEnsemble.daily).filter((key) => key.startsWith('temperature_2m_mean_member'));
  const index = Math.min(days - 1, liveEnsemble.daily.time.length - 1);
  const values = memberKeys.map((key) => liveEnsemble.daily[key][index]).filter(Number.isFinite);
  if (values.length < 10) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const spread = Math.sqrt(variance);
  const agreement = Math.max(18, Math.min(94, Math.round(100 - spread * 15)));
  return { agreement, risk: Math.round(100 - agreement) };
}

function updateAnalysis() {
  const days = Number(horizon.value);
  const threshold = Number(document.querySelector('.threshold-btn.selected').dataset.threshold);
  const liveMetrics = getLiveMetrics(days);
  const fallbackRisk = Math.min(96, Math.round(baseRisk + (days - 10) * 2.7));
  const risk = liveMetrics ? Math.min(96, Math.round(liveMetrics.risk + (days - 10) * 1.4)) : fallbackRisk;
  const confidence = liveMetrics ? Math.max(28, 100 - risk) : Math.max(28, Math.round(baseConfidence - (days - 10) * 2.1));
  const agreement = liveMetrics ? liveMetrics.agreement : Math.max(19, Math.round(confidence * .69));
  const breakDay = Math.max(5, Math.min(13, Math.round(17 - confidence / 9)));

  horizonValue.textContent = `D+${days}`;
  riskValue.textContent = risk;
  riskMeter.style.width = `${risk}%`;
  confidenceValue.textContent = confidence;
  confidenceBar.style.width = `${confidence}%`;
  document.querySelector('#agreementValue').textContent = agreement;
  document.querySelector('.inflection-line b').textContent = `D+${breakDay} window`;
  document.querySelector('.chart-callout strong').textContent = `Break point detected at D+${breakDay}`;
  document.querySelector('.chart-callout p').textContent = agreement < threshold ? `Agreement falls below your ${threshold}% alert threshold as the Atlantic ridge weakens.` : `Agreement remains above your ${threshold}% alert threshold, but the ridge pattern warrants monitoring.`;

  riskMessage.textContent = risk >= threshold ? 'Elevated · confidence is decaying faster than normal' : 'Contained · no immediate forecast bust signal';
  confidenceCopy.textContent = confidence < 65 ? 'Moderate · human review recommended' : 'Good · within expected skill range';
  document.querySelector('#riskTrend').textContent = risk >= 65 ? '↑ 7' : '↓ 4';
  document.querySelector('.callout-score').firstChild.textContent = `${(Math.min(.98, .42 + risk / 220)).toFixed(2)} `;

  document.querySelectorAll('#agreementBars i').forEach((bar, index) => {
    bar.style.height = `${Math.max(24, agreement - index * 5 + (index % 2) * 13)}%`;
  });
}

for (let index = 0; index < 11; index += 1) {
  const bar = document.createElement('i');
  document.querySelector('#agreementBars').appendChild(bar);
}

horizon.addEventListener('input', updateAnalysis);
cityInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') fetchLiveEnsemble();
});
citySubmit.addEventListener('click', fetchLiveEnsemble);
thresholds.forEach((button) => button.addEventListener('click', () => {
  thresholds.forEach((item) => item.classList.remove('selected'));
  button.classList.add('selected');
  updateAnalysis();
}));

document.querySelector('#runAnalysis').addEventListener('click', () => {
  fetchLiveEnsemble();
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 3200);
});
document.querySelector('#explainButton').addEventListener('click', (event) => {
  event.currentTarget.innerHTML = 'Reasoning synced to current run <span>✓</span>';
  event.currentTarget.style.color = '#5b8368';
});
updateAnalysis();
fetchLiveEnsemble();
