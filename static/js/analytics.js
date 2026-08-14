// analytics.js — fetches /api/analytics/summary and renders the Figma-matched analytics page.
// Budget figures use a hardcoded placeholder (MONTHLY_BUDGET) — Spendly has no real budgets table yet.

(function () {
    const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const MONTH_NAMES_FULL = ["", "January", "February", "March", "April", "May", "June",
                               "July", "August", "September", "October", "November", "December"];
    const MONTHLY_BUDGET = 2000;

    const CATEGORY_META = {
        Bill: { color: "#F59E0B", icon: "🧾" },
        Shopping: { color: "#EC4899", icon: "🛍️" },
        Groceries: { color: "#10B981", icon: "🛒" },
        Travel: { color: "#3B82F6", icon: "✈️" },
        Loans: { color: "#8B5CF6", icon: "💳" },
        Health: { color: "#EF4444", icon: "❤️" },
        Entertainment: { color: "#6366F1", icon: "🎬" },
        Others: { color: "#64748B", icon: "📦" },
        Food: { color: "#F97316", icon: "🍔" },
    };
    const FALLBACK_META = { color: "#94A3B8", icon: "•" };
    function categoryMeta(cat) { return CATEGORY_META[cat] || FALLBACK_META; }

    const ICONS = {
        trendingUp: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
        trendingDown: '<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>',
        arrowUpRight: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
        chevronUp: '<path d="m18 15-6-6-6 6"/>',
        chevronDown: '<path d="m6 9 6 6 6-6"/>',
        chevronsUpDown: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
    };
    function iconSvg(name, cls) {
        return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
    }

    function formatCurrency(n) {
        return "€" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
    }
    function formatCurrency2(n) {
        return "€" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function formatK(n) {
        return "€" + (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    }

    async function fetchSummary() {
        const res = await fetch("/api/analytics/summary");
        if (res.status === 401) {
            window.location.href = "/login";
            return null;
        }
        if (!res.ok) throw new Error("Failed to load analytics data");
        return res.json();
    }

    // ---- data shaping -------------------------------------------------

    function buildYearSeries(monthlyTotals) {
        const byYear = {};
        monthlyTotals.forEach((r) => {
            if (!byYear[r.year]) byYear[r.year] = new Array(13).fill(0);
            byYear[r.year][r.month] = r.total;
        });
        return byYear;
    }

    function sparkFor(monthlyTotals, count) {
        return monthlyTotals.slice(-count).map((r) => r.total);
    }

    function renderSparkline(svgEl, data, color) {
        svgEl.innerHTML = "";
        if (data.length === 0) return;
        const max = Math.max(...data, 1);
        const h = 28, barW = 4, gap = 2;
        const w = data.length * (barW + gap) - gap;
        svgEl.setAttribute("width", w);
        svgEl.setAttribute("height", h);
        data.forEach((v, i) => {
            const barH = Math.max(3, (v / max) * h);
            const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            rect.setAttribute("x", i * (barW + gap));
            rect.setAttribute("y", h - barH);
            rect.setAttribute("width", barW);
            rect.setAttribute("height", barH);
            rect.setAttribute("rx", 2);
            rect.setAttribute("fill", color);
            rect.setAttribute("opacity", 0.3 + (i / Math.max(1, data.length - 1)) * 0.7);
            svgEl.appendChild(rect);
        });
    }

    // ---- hero panel -----------------------------------------------------

    function renderHero(monthlyTotals, summary) {
        if (monthlyTotals.length === 0) return;
        const current = monthlyTotals[monthlyTotals.length - 1];
        const spent = current.total;
        const pct = (spent / MONTHLY_BUDGET) * 100;
        const over = spent > MONTHLY_BUDGET;

        document.getElementById("hero-period").textContent = `${MONTH_NAMES_FULL[current.month]} ${current.year}`;

        const badge = document.getElementById("hero-budget-badge");
        badge.textContent = over ? "Over budget" : `${pct.toFixed(0)}% of budget`;
        badge.className = "inline-flex items-center rounded-md px-2 py-0.5 text-xs border " +
            (over ? "bg-red-500/20 text-red-300 border-red-500/30" : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30");

        document.getElementById("hero-spent").textContent = formatCurrency(spent);
        document.getElementById("hero-budget-total").textContent = `Budget: ${formatCurrency(MONTHLY_BUDGET)}`;

        const remaining = MONTHLY_BUDGET - spent;
        const remainEl = document.getElementById("hero-budget-remaining");
        remainEl.textContent = over ? `${formatCurrency(Math.abs(remaining))} over` : `${formatCurrency(remaining)} left`;
        remainEl.className = over ? "text-red-400" : "text-emerald-400";

        const bar = document.getElementById("hero-budget-bar");
        bar.style.width = `${Math.min(pct, 100)}%`;
        bar.className = "h-full rounded-full transition-all " + (over ? "bg-red-400" : "bg-gradient-to-r from-violet-400 to-indigo-400");

        const currentYear = current.year;
        const priorYear = currentYear - 1;
        const byYear = buildYearSeries(monthlyTotals);
        const ytd = (byYear[currentYear] || []).reduce((a, b) => a + b, 0);
        let priorYtd = 0;
        for (let m = 1; m <= current.month; m++) priorYtd += (byYear[priorYear] || [])[m] || 0;
        document.getElementById("hero-ytd").textContent = formatCurrency(ytd);

        const ytdChangeEl = document.getElementById("hero-ytd-change");
        if (priorYtd > 0) {
            const change = ((ytd - priorYtd) / priorYtd) * 100;
            const up = change > 0;
            ytdChangeEl.className = `flex items-center gap-1 mt-1 text-xs ${up ? "text-red-400" : "text-emerald-400"}`;
            ytdChangeEl.innerHTML = iconSvg(up ? "trendingUp" : "trendingDown", "size-3") +
                `<span>${up ? "+" : ""}${change.toFixed(1)}% vs ${priorYear}</span>`;
        } else {
            ytdChangeEl.textContent = "";
        }

        document.getElementById("hero-avg").textContent = formatCurrency(summary.average_monthly_spend);
        const first = monthlyTotals[0];
        document.getElementById("hero-range").textContent =
            `${MONTH_NAMES[first.month]} ${first.year} – ${MONTH_NAMES[current.month]} ${current.year}`;

        renderHeroChart(byYear, currentYear, priorYear);
    }

    let heroChart = null;
    function renderHeroChart(byYear, currentYear, priorYear) {
        const labels = MONTH_NAMES.slice(1);
        const currentData = (byYear[currentYear] || new Array(13).fill(0)).slice(1).map((v) => v || null);
        const priorData = (byYear[priorYear] || new Array(13).fill(0)).slice(1).map((v) => v || null);

        const ctx = document.getElementById("hero-chart");
        if (heroChart) heroChart.destroy();
        heroChart = new Chart(ctx, {
            type: "line",
            data: {
                labels,
                datasets: [
                    {
                        label: String(priorYear), data: priorData, borderColor: "#6366F1",
                        borderWidth: 1.5, borderDash: [4, 3], backgroundColor: "rgba(99,102,241,0.12)",
                        fill: true, pointRadius: 0, tension: 0.3, spanGaps: true,
                    },
                    {
                        label: String(currentYear), data: currentData, borderColor: "#8B5CF6",
                        borderWidth: 2, backgroundColor: "rgba(139,92,246,0.18)",
                        fill: true, pointRadius: 0, tension: 0.3, spanGaps: true,
                    },
                ],
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: "#94a3b8", font: { size: 11 } }, grid: { display: false } },
                    y: { ticks: { color: "#94a3b8", font: { size: 11 }, callback: (v) => formatK(v) }, grid: { color: "rgba(255,255,255,0.06)" } },
                },
            },
        });
    }

    // ---- summary cards ----------------------------------------------------

    function setCardChange(card, text, up, showTrend) {
        const el = card.querySelector("[data-change]");
        if (!showTrend) { el.textContent = text; return; }
        el.className = `flex items-center gap-1 mt-1.5 text-xs ${up ? "text-red-600" : "text-emerald-600"}`;
        el.innerHTML = iconSvg(up ? "trendingUp" : "trendingDown", "size-3 shrink-0") + `<span>${text}</span>`;
    }

    function renderSummaryCards(monthlyTotals, summary, categoryTotals) {
        if (monthlyTotals.length === 0) return;
        const current = monthlyTotals[monthlyTotals.length - 1];
        const spent = current.total;
        const pct = (spent / MONTHLY_BUDGET) * 100;

        const totalCard = document.querySelector('[data-card="total"]');
        totalCard.querySelector("[data-value]").textContent = formatCurrency(spent);
        totalCard.querySelector("[data-sub]").textContent = `of ${formatCurrency(MONTHLY_BUDGET)} budget`;
        setCardChange(totalCard, `${pct.toFixed(0)}% used`, pct > 90, true);
        renderSparkline(totalCard.querySelector("[data-spark]"), sparkFor(monthlyTotals, 7), "#8B5CF6");

        const currentYear = current.year, priorYear = currentYear - 1;
        const byYear = buildYearSeries(monthlyTotals);
        const currentYearMonths = (byYear[currentYear] || []).filter((v, i) => i > 0 && v > 0);
        const priorYearMonths = (byYear[priorYear] || []).filter((v, i) => i > 0 && v > 0);
        const currentAvg = currentYearMonths.length ? currentYearMonths.reduce((a, b) => a + b, 0) / currentYearMonths.length : 0;
        const priorAvg = priorYearMonths.length ? priorYearMonths.reduce((a, b) => a + b, 0) / priorYearMonths.length : 0;

        const avgCard = document.querySelector('[data-card="average"]');
        avgCard.querySelector("[data-value]").textContent = formatCurrency(summary.average_monthly_spend);
        const first = monthlyTotals[0];
        avgCard.querySelector("[data-sub]").textContent = `${MONTH_NAMES[first.month]} ${first.year} – ${MONTH_NAMES[current.month]} ${current.year}`;
        if (priorAvg > 0) {
            const change = ((currentAvg - priorAvg) / priorAvg) * 100;
            setCardChange(avgCard, `${change > 0 ? "+" : ""}${change.toFixed(1)}% vs ${priorYear}`, change > 0, true);
        } else {
            setCardChange(avgCard, "—", false, true);
        }
        renderSparkline(avgCard.querySelector("[data-spark]"), sparkFor(monthlyTotals, 7), "#3B82F6");

        if (categoryTotals.length > 0) {
            const top = categoryTotals[0];
            const grandTotal = categoryTotals.reduce((a, b) => a + b.total, 0);
            const topCard = document.querySelector('[data-card="top-category"]');
            topCard.querySelector("[data-value]").textContent = top.category;
            topCard.querySelector("[data-sub]").textContent = `${formatCurrency(top.total)} total`;
            setCardChange(topCard, `${((top.total / grandTotal) * 100).toFixed(0)}% of spending`, false, false);
        }

        const remaining = Math.max(0, MONTHLY_BUDGET - spent);
        const remainPct = Math.max(0, 100 - pct);
        const budgetCard = document.querySelector('[data-card="budget"]');
        budgetCard.querySelector("[data-value]").textContent = formatCurrency(remaining);
        budgetCard.querySelector("[data-sub]").textContent = `${remainPct.toFixed(0)}% of monthly budget`;
        setCardChange(budgetCard, `${remainPct.toFixed(0)}% remaining`, false, false);
    }

    // ---- trend chart ----------------------------------------------------

    let trendChart = null;
    let trendMode = "comparison";

    function renderTrendChart(monthlyTotals) {
        const current = monthlyTotals[monthlyTotals.length - 1];
        const currentYear = current.year, priorYear = currentYear - 1;
        const byYear = buildYearSeries(monthlyTotals);
        const currentSeries = (byYear[currentYear] || new Array(13).fill(0)).slice(1);
        const priorSeries = (byYear[priorYear] || new Array(13).fill(0)).slice(1);
        const labels = MONTH_NAMES.slice(1);

        document.getElementById("trend-description").textContent =
            `${MONTH_NAMES[1]} – ${MONTH_NAMES[current.month]} ${currentYear} · year-over-year comparison`;
        document.getElementById("trend-legend-current").textContent = String(currentYear);
        document.getElementById("trend-legend-prior").textContent = String(priorYear);
        document.getElementById("trend-legend-prior-wrap").style.display = trendMode === "comparison" ? "flex" : "none";
        document.getElementById("trend-legend-budget").textContent = `Budget ${formatK(MONTHLY_BUDGET)}`;

        const barColors = currentSeries.map((v, i) =>
            v > MONTHLY_BUDGET ? "#EF4444" : "#8B5CF6");

        const datasets = [
            {
                type: "bar", label: String(currentYear), data: currentSeries,
                backgroundColor: barColors, borderRadius: 3, maxBarThickness: 20, order: 2,
            },
            {
                type: "line", label: "Budget", data: labels.map(() => MONTHLY_BUDGET),
                borderColor: "#10B981", borderDash: [4, 3], borderWidth: 1.5,
                pointRadius: 0, fill: false, order: 1,
            },
        ];
        if (trendMode === "comparison") {
            datasets.unshift({
                type: "bar", label: String(priorYear), data: priorSeries,
                backgroundColor: "#C4B5FD", borderRadius: 3, maxBarThickness: 20, order: 3,
            });
        }

        const ctx = document.getElementById("trend-chart");
        if (trendChart) trendChart.destroy();
        trendChart = new Chart(ctx, {
            type: "bar",
            data: { labels, datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: "#64748b", font: { size: 11 } } },
                    y: { grid: { color: "#e2e8f0" }, ticks: { color: "#64748b", font: { size: 11 }, callback: (v) => formatK(v) } },
                },
            },
        });

        const nonZero = currentSeries.map((v, i) => ({ month: i + 1, total: v })).filter((r) => r.total > 0);
        const footer = document.getElementById("trend-footer-stats");
        footer.innerHTML = "";
        if (nonZero.length > 0) {
            const highest = nonZero.reduce((a, b) => (b.total > a.total ? b : a));
            const lowest = nonZero.reduce((a, b) => (b.total < a.total ? b : a));
            const ytdTotal = currentSeries.reduce((a, b) => a + b, 0);
            [
                { label: "Highest month", value: formatCurrency(highest.total), sub: `${MONTH_NAMES_FULL[highest.month]} ${currentYear}`, color: "text-red-600" },
                { label: "Lowest month", value: formatCurrency(lowest.total), sub: `${MONTH_NAMES_FULL[lowest.month]} ${currentYear}`, color: "text-emerald-600" },
                { label: "YTD total", value: formatCurrency(ytdTotal), sub: `${MONTH_NAMES[1]} – ${MONTH_NAMES[current.month]} ${currentYear}`, color: "text-violet-600" },
            ].forEach((s) => {
                const div = document.createElement("div");
                div.className = "text-center";
                div.innerHTML = `<div class="text-sm ${s.color}">${s.value}</div>
                    <div class="text-xs text-slate-500 mt-0.5">${s.label}</div>
                    <div class="text-xs text-slate-400">${s.sub}</div>`;
                footer.appendChild(div);
            });
        }
    }

    function wireToggle(containerId, onChange) {
        const container = document.getElementById(containerId);
        const buttons = container.querySelectorAll("button");
        function apply(active) {
            buttons.forEach((b) => {
                const isActive = b.dataset.mode === active;
                b.className = `rounded-md px-3 py-1 text-xs transition-colors ${isActive ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-900"}`;
            });
        }
        buttons.forEach((b) => {
            b.addEventListener("click", () => {
                apply(b.dataset.mode);
                onChange(b.dataset.mode);
            });
        });
        apply(buttons[0].dataset.mode);
    }

    // ---- category breakdown ----------------------------------------------

    let donutChart = null;
    let barChart = null;

    function renderCategoryBreakdown(categoryTotals, monthlyTotals) {
        const grandTotal = categoryTotals.reduce((a, b) => a + b.total, 0);
        document.getElementById("category-description").textContent = `Breakdown across ${categoryTotals.reduce((a, b) => a + b.count, 0)} transactions`;
        document.getElementById("category-donut-total").textContent =
            grandTotal >= 1000 ? formatK(grandTotal) : formatCurrency(grandTotal);

        const ctx = document.getElementById("category-donut-chart");
        if (donutChart) donutChart.destroy();
        donutChart = new Chart(ctx, {
            type: "doughnut",
            data: {
                labels: categoryTotals.map((c) => c.category),
                datasets: [{
                    data: categoryTotals.map((c) => c.total),
                    backgroundColor: categoryTotals.map((c) => categoryMeta(c.category).color),
                    borderColor: "#fff", borderWidth: 2,
                }],
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: "62%",
                plugins: { legend: { display: false } },
            },
        });

        const legend = document.getElementById("category-legend");
        legend.innerHTML = "";
        categoryTotals.forEach((c) => {
            const pct = grandTotal ? (c.total / grandTotal) * 100 : 0;
            const meta = categoryMeta(c.category);
            const row = document.createElement("div");
            row.className = "flex items-center gap-2";
            row.innerHTML = `
                <span class="text-sm w-4 shrink-0">${meta.icon}</span>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between mb-0.5">
                        <span class="text-xs text-slate-900 truncate">${c.category}</span>
                        <span class="text-xs text-slate-500 ml-2 shrink-0">${pct.toFixed(1)}%</span>
                    </div>
                    <div class="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div class="h-full rounded-full" style="width:${pct}%;background:${meta.color}"></div>
                    </div>
                </div>
                <span class="text-xs w-16 text-right shrink-0 text-slate-900">${formatCurrency(c.total)}</span>
            `;
            legend.appendChild(row);
        });

        function renderBarView() {
            const periodCount = Object.keys(buildYearSeries(monthlyTotals)).length
                ? monthlyTotals.length : 1;
            const data = categoryTotals.map((c) => Math.round(c.total / Math.max(1, periodCount)));
            const bctx = document.getElementById("category-bar-chart");
            if (barChart) barChart.destroy();
            barChart = new Chart(bctx, {
                type: "bar",
                data: {
                    labels: categoryTotals.map((c) => c.category),
                    datasets: [{ data, backgroundColor: categoryTotals.map((c) => categoryMeta(c.category).color), borderRadius: 3, maxBarThickness: 14 }],
                },
                options: {
                    indexAxis: "y", responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { color: "#64748b", font: { size: 10 }, callback: (v) => `€${v}` }, grid: { color: "#e2e8f0" } },
                        y: { ticks: { color: "#64748b", font: { size: 10 } }, grid: { display: false } },
                    },
                },
            });
        }

        wireToggle("category-toggle", (mode) => {
            document.getElementById("category-donut-view").classList.toggle("hidden", mode !== "donut");
            document.getElementById("category-bar-view").classList.toggle("hidden", mode !== "bar");
            if (mode === "bar" && !barChart) renderBarView();
        });
    }

    // ---- category stats table ---------------------------------------------

    let categorySort = { col: "total", dir: "desc" };

    function renderCategoryTable(categoryTotals, monthlyTotals) {
        const periodCount = Math.max(1, monthlyTotals.length);
        const grandTotal = categoryTotals.reduce((a, b) => a + b.total, 0);
        const rows = categoryTotals.map((c) => ({
            ...c,
            avg: Math.round(c.total / periodCount),
            pct: grandTotal ? (c.total / grandTotal) * 100 : 0,
        }));

        const columns = [
            { key: "category", label: "Category" },
            { key: "total", label: "Total", right: true },
            { key: "avg", label: "Avg / Month", right: true },
            { key: "count", label: "Transactions", right: true },
        ];

        function sortIcon(key) {
            if (categorySort.col !== key) return iconSvg("chevronsUpDown", "size-3 text-slate-300");
            return iconSvg(categorySort.dir === "asc" ? "chevronUp" : "chevronDown", "size-3");
        }

        function draw() {
            const head = document.getElementById("category-table-head");
            head.innerHTML = "";
            columns.forEach((col) => {
                const th = document.createElement("th");
                th.className = `px-4 py-2.5 text-xs text-slate-500 ${col.right ? "text-right" : "text-left"}`;
                th.innerHTML = `<button type="button" class="flex items-center gap-1 hover:text-slate-900 transition-colors ${col.right ? "ml-auto" : ""}" data-sort="${col.key}">${col.label} ${sortIcon(col.key)}</button>`;
                head.appendChild(th);
            });
            const shareTh = document.createElement("th");
            shareTh.className = "px-4 py-2.5 text-xs text-slate-500 text-left";
            shareTh.textContent = "Share of spend";
            head.appendChild(shareTh);

            head.querySelectorAll("[data-sort]").forEach((btn) => {
                btn.addEventListener("click", () => {
                    const key = btn.dataset.sort;
                    if (categorySort.col === key) categorySort.dir = categorySort.dir === "asc" ? "desc" : "asc";
                    else categorySort = { col: key, dir: "desc" };
                    draw();
                });
            });

            const sorted = [...rows].sort((a, b) => {
                let x = a[categorySort.col], y = b[categorySort.col];
                if (typeof x === "string") { x = x.toLowerCase(); y = y.toLowerCase(); }
                if (x < y) return categorySort.dir === "asc" ? -1 : 1;
                if (x > y) return categorySort.dir === "asc" ? 1 : -1;
                return 0;
            });

            const body = document.getElementById("category-table-body");
            body.innerHTML = "";
            sorted.forEach((c) => {
                const meta = categoryMeta(c.category);
                const tr = document.createElement("tr");
                tr.className = "border-b last:border-0 hover:bg-slate-50 transition-colors";
                tr.innerHTML = `
                    <td class="px-4 py-3">
                        <div class="flex items-center gap-2">
                            <div class="flex size-7 shrink-0 items-center justify-center rounded-md text-sm" style="background:${meta.color}18">${meta.icon}</div>
                            <span class="text-sm text-slate-900">${c.category}</span>
                        </div>
                    </td>
                    <td class="px-4 py-3 text-right text-sm text-slate-900">${formatCurrency(c.total)}</td>
                    <td class="px-4 py-3 text-right text-sm text-slate-900">${formatCurrency(c.avg)}</td>
                    <td class="px-4 py-3 text-right text-sm text-slate-900">${c.count}</td>
                    <td class="px-4 py-3">
                        <div class="flex items-center gap-2 min-w-[120px]">
                            <div class="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                                <div class="h-full rounded-full" style="width:${c.pct}%;background:${meta.color}"></div>
                            </div>
                            <span class="text-xs text-slate-500 w-9 text-right shrink-0">${c.pct.toFixed(1)}%</span>
                        </div>
                    </td>
                `;
                body.appendChild(tr);
            });

            const foot = document.getElementById("category-table-foot");
            const totalTx = categoryTotals.reduce((a, b) => a + b.count, 0);
            foot.innerHTML = `
                <tr class="border-t bg-slate-50">
                    <td class="px-4 py-2.5 text-xs text-slate-500">All categories</td>
                    <td class="px-4 py-2.5 text-right text-sm text-slate-900">${formatCurrency(grandTotal)}</td>
                    <td class="px-4 py-2.5 text-right text-xs text-slate-500">${formatCurrency(Math.round(grandTotal / periodCount))}</td>
                    <td class="px-4 py-2.5 text-right text-xs text-slate-500">${totalTx}</td>
                    <td class="px-4 py-2.5"></td>
                </tr>
            `;
        }
        draw();
    }

    // ---- transactions table ------------------------------------------------

    let txSort = { col: "period", dir: "desc" };
    let txFilter = "all";
    let txExpanded = false;

    function renderTransactionsTable(transactions, categoryTotals) {
        const select = document.getElementById("category-filter");
        select.innerHTML = '<option value="all">All categories</option>';
        categoryTotals.forEach((c) => {
            const opt = document.createElement("option");
            opt.value = c.category;
            opt.textContent = `${categoryMeta(c.category).icon} ${c.category}`;
            select.appendChild(opt);
        });
        select.value = txFilter;
        select.addEventListener("change", () => { txFilter = select.value; txExpanded = false; draw(); });

        const columns = [
            { key: "expense_name", label: "Merchant" },
            { key: "category", label: "Category", noSort: true },
            { key: "period", label: "Date" },
            { key: "amount", label: "Amount", right: true },
        ];

        function sortIcon(key) {
            if (txSort.col !== key) return iconSvg("chevronsUpDown", "size-3 text-slate-300");
            return iconSvg(txSort.dir === "asc" ? "chevronUp" : "chevronDown", "size-3");
        }

        function draw() {
            const filtered = transactions.filter((t) => txFilter === "all" || t.category === txFilter);

            const sorted = [...filtered].sort((a, b) => {
                let x, y;
                if (txSort.col === "period") { x = a.year * 100 + a.month; y = b.year * 100 + b.month; }
                else if (txSort.col === "amount") { x = a.amount; y = b.amount; }
                else { x = a.expense_name.toLowerCase(); y = b.expense_name.toLowerCase(); }
                if (x < y) return txSort.dir === "asc" ? -1 : 1;
                if (x > y) return txSort.dir === "asc" ? 1 : -1;
                return 0;
            });

            document.getElementById("transactions-count").textContent = filtered.length;

            const head = document.getElementById("transactions-table-head");
            head.innerHTML = "";
            columns.forEach((col) => {
                const th = document.createElement("th");
                th.className = `px-4 py-2.5 text-xs text-slate-500 ${col.right ? "text-right" : "text-left"}`;
                if (col.noSort) {
                    th.textContent = col.label;
                } else {
                    th.innerHTML = `<button type="button" class="flex items-center gap-1 hover:text-slate-900 transition-colors ${col.right ? "ml-auto" : ""}" data-sort="${col.key}">${col.label} ${sortIcon(col.key)}</button>`;
                }
                head.appendChild(th);
            });
            head.querySelectorAll("[data-sort]").forEach((btn) => {
                btn.addEventListener("click", () => {
                    const key = btn.dataset.sort;
                    if (txSort.col === key) txSort.dir = txSort.dir === "asc" ? "desc" : "asc";
                    else txSort = { col: key, dir: key === "amount" ? "desc" : "asc" };
                    draw();
                });
            });

            const visible = txExpanded ? sorted : sorted.slice(0, 8);
            const body = document.getElementById("transactions-table-body");
            body.innerHTML = "";
            if (visible.length === 0) {
                body.innerHTML = '<tr><td colspan="4" class="px-4 py-10 text-center text-sm text-slate-500">No transactions found.</td></tr>';
            } else {
                visible.forEach((t) => {
                    const meta = categoryMeta(t.category);
                    const tr = document.createElement("tr");
                    tr.className = "border-b last:border-0 hover:bg-slate-50 transition-colors";
                    tr.innerHTML = `
                        <td class="px-4 py-3">
                            <div class="flex items-center gap-2.5">
                                <div class="flex size-8 shrink-0 items-center justify-center rounded-lg text-sm" style="background:${meta.color}18">${meta.icon}</div>
                                <div>
                                    <div class="text-sm text-slate-900 leading-tight" data-merchant></div>
                                    ${t.note ? `<div class="text-xs text-slate-500" data-note></div>` : ""}
                                </div>
                            </div>
                        </td>
                        <td class="px-4 py-3">
                            <span class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs" style="border-color:${meta.color}40;color:${meta.color};background:${meta.color}10">${t.category}</span>
                        </td>
                        <td class="px-4 py-3"><span class="text-xs text-slate-500">${MONTH_NAMES[t.month]} ${t.year}</span></td>
                        <td class="px-4 py-3 text-right">
                            <div class="flex items-center justify-end gap-1">
                                ${iconSvg("arrowUpRight", "size-3 text-red-500 shrink-0")}
                                <span class="text-sm text-slate-900">${formatCurrency2(t.amount)}</span>
                            </div>
                        </td>
                    `;
                    tr.querySelector("[data-merchant]").textContent = t.expense_name;
                    if (t.note) tr.querySelector("[data-note]").textContent = t.note;
                    body.appendChild(tr);
                });
            }

            const wrap = document.getElementById("transactions-show-more-wrap");
            const btn = document.getElementById("transactions-show-more");
            if (sorted.length > 8) {
                wrap.classList.remove("hidden");
                btn.textContent = txExpanded ? "Show less" : `Show all ${sorted.length} transactions`;
                btn.onclick = () => { txExpanded = !txExpanded; draw(); };
            } else {
                wrap.classList.add("hidden");
            }
        }
        draw();
    }

    // ---- boot -------------------------------------------------------------

    async function loadAnalytics() {
        const data = await fetchSummary();
        if (!data) return;
        const { summary, monthly_totals, category_totals, recent_transactions } = data;

        renderHero(monthly_totals, summary);
        renderSummaryCards(monthly_totals, summary, category_totals);

        wireToggle("trend-toggle", (mode) => { trendMode = mode; renderTrendChart(monthly_totals); });
        renderTrendChart(monthly_totals);

        renderCategoryBreakdown(category_totals, monthly_totals);
        renderCategoryTable(category_totals, monthly_totals);
        renderTransactionsTable(recent_transactions, category_totals);
    }

    loadAnalytics();
})();
