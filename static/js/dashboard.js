// dashboard.js — fetches /api/dashboard/summary, renders Chart.js charts, wires the filter form

(function () {
    const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    let monthlyChart = null;
    let categoryChart = null;

    function formatCurrency(n) {
        return "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
    }

    async function fetchSummary(month, year) {
        const params = new URLSearchParams();
        if (month) params.set("month", month);
        if (year) params.set("year", year);
        const qs = params.toString();
        const res = await fetch(`/api/dashboard/summary${qs ? "?" + qs : ""}`);
        if (res.status === 401) {
            window.location.href = "/login";
            return null;
        }
        if (!res.ok) throw new Error("Failed to load dashboard data");
        return res.json();
    }

    function renderStats(summary) {
        document.getElementById("stat-total").textContent = formatCurrency(summary.total_spend);
        document.getElementById("stat-average").textContent = formatCurrency(summary.average_monthly_spend);
        document.getElementById("stat-count").textContent = summary.expense_count;
    }

    function renderTopExpenses(rows) {
        const body = document.getElementById("top-expenses-body");
        body.innerHTML = "";
        rows.forEach((r) => {
            const tr = document.createElement("tr");
            const tdName = document.createElement("td");
            tdName.textContent = r.expense_name;
            const tdCategory = document.createElement("td");
            tdCategory.textContent = r.category;
            const tdPeriod = document.createElement("td");
            tdPeriod.textContent = `${MONTH_NAMES[r.month]} ${r.year}`;
            const tdAmount = document.createElement("td");
            tdAmount.textContent = formatCurrency(r.amount);
            tr.append(tdName, tdCategory, tdPeriod, tdAmount);
            body.appendChild(tr);
        });
    }

    function renderMonthlyChart(rows) {
        const labels = rows.map((r) => `${MONTH_NAMES[r.month]} ${r.year}`);
        const data = rows.map((r) => r.total);
        if (monthlyChart) {
            monthlyChart.data.labels = labels;
            monthlyChart.data.datasets[0].data = data;
            monthlyChart.update();
            return;
        }
        const ctx = document.getElementById("monthly-trend-chart");
        monthlyChart = new Chart(ctx, {
            type: "line",
            data: { labels, datasets: [{ label: "Spend", data, borderColor: "#1a472a", tension: 0.3 }] },
            options: { responsive: true },
        });
    }

    function renderCategoryChart(rows) {
        const labels = rows.map((r) => r.category);
        const data = rows.map((r) => r.total);
        if (categoryChart) {
            categoryChart.data.labels = labels;
            categoryChart.data.datasets[0].data = data;
            categoryChart.update();
            return;
        }
        const ctx = document.getElementById("category-chart");
        categoryChart = new Chart(ctx, {
            type: "doughnut",
            data: { labels, datasets: [{ data }] },
            options: { responsive: true },
        });
    }

    async function loadDashboard(month, year) {
        const data = await fetchSummary(month, year);
        if (!data) return;
        renderStats(data.summary);
        renderMonthlyChart(data.monthly_totals);
        renderCategoryChart(data.category_totals);
        renderTopExpenses(data.top_expenses);
    }

    const form = document.getElementById("filter-form");
    const monthInput = document.getElementById("filter-month");
    const yearInput = document.getElementById("filter-year");
    const clearBtn = document.getElementById("filter-clear");

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        loadDashboard(monthInput.value || null, yearInput.value || null);
    });

    clearBtn.addEventListener("click", () => {
        form.reset();
        loadDashboard(null, null);
    });

    loadDashboard(null, null);
})();
