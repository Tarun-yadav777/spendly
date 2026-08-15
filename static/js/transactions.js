// transactions.js — fetches /api/transactions and renders the full, filterable,
// editable/deletable transactions list. Adapted from analytics.js's
// renderTransactionsTable, but shows every row (no 8-row cap/show-more) and
// adds category/month/year filters plus per-row Edit/Delete actions.

(function () {
    const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
        arrowUpRight: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
        chevronUp: '<path d="m18 15-6-6-6 6"/>',
        chevronDown: '<path d="m6 9 6 6 6-6"/>',
        chevronsUpDown: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
    };
    function iconSvg(name, cls) {
        return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
    }

    function formatCurrency2(n) {
        return "€" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    async function fetchTransactions() {
        const res = await fetch("/api/transactions");
        if (res.status === 401) {
            window.location.href = "/login";
            return null;
        }
        if (!res.ok) throw new Error("Failed to load transactions");
        const data = await res.json();
        return data.transactions;
    }

    let sort = { col: "period", dir: "desc" };
    let filters = { category: "all", month: "all", year: "all" };

    function renderTransactions(transactions) {
        const categorySelect = document.getElementById("category-filter");
        const monthSelect = document.getElementById("month-filter");
        const yearSelect = document.getElementById("year-filter");

        const categories = [...new Set(transactions.map((t) => t.category))].sort();
        categories.forEach((c) => {
            const opt = document.createElement("option");
            opt.value = c;
            opt.textContent = `${categoryMeta(c).icon} ${c}`;
            categorySelect.appendChild(opt);
        });

        const months = [...new Set(transactions.map((t) => t.month))].sort((a, b) => a - b);
        months.forEach((m) => {
            const opt = document.createElement("option");
            opt.value = m;
            opt.textContent = MONTH_NAMES[m];
            monthSelect.appendChild(opt);
        });

        const years = [...new Set(transactions.map((t) => t.year))].sort((a, b) => b - a);
        years.forEach((y) => {
            const opt = document.createElement("option");
            opt.value = y;
            opt.textContent = y;
            yearSelect.appendChild(opt);
        });

        [categorySelect, monthSelect, yearSelect].forEach((select) => {
            select.addEventListener("change", () => {
                filters.category = categorySelect.value;
                filters.month = monthSelect.value;
                filters.year = yearSelect.value;
                draw();
            });
        });

        const columns = [
            { key: "expense_name", label: "Merchant" },
            { key: "category", label: "Category", noSort: true },
            { key: "period", label: "Date" },
            { key: "amount", label: "Amount", right: true },
            { key: "actions", label: "Actions", noSort: true },
        ];

        function sortIcon(key) {
            if (sort.col !== key) return iconSvg("chevronsUpDown", "size-3 text-slate-300");
            return iconSvg(sort.dir === "asc" ? "chevronUp" : "chevronDown", "size-3");
        }

        function draw() {
            const filtered = transactions.filter((t) =>
                (filters.category === "all" || t.category === filters.category) &&
                (filters.month === "all" || String(t.month) === filters.month) &&
                (filters.year === "all" || String(t.year) === filters.year)
            );

            const sorted = [...filtered].sort((a, b) => {
                let x, y;
                if (sort.col === "period") { x = a.year * 100 + a.month; y = b.year * 100 + b.month; }
                else if (sort.col === "amount") { x = a.amount; y = b.amount; }
                else { x = a.expense_name.toLowerCase(); y = b.expense_name.toLowerCase(); }
                if (x < y) return sort.dir === "asc" ? -1 : 1;
                if (x > y) return sort.dir === "asc" ? 1 : -1;
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
                    if (sort.col === key) sort.dir = sort.dir === "asc" ? "desc" : "asc";
                    else sort = { col: key, dir: key === "amount" ? "desc" : "asc" };
                    draw();
                });
            });

            const body = document.getElementById("transactions-table-body");
            body.innerHTML = "";
            if (sorted.length === 0) {
                body.innerHTML = '<tr><td colspan="5" class="px-4 py-10 text-center text-sm text-slate-500">No transactions found.</td></tr>';
            } else {
                sorted.forEach((t) => {
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
                        <td class="px-4 py-3">
                            <div class="flex items-center justify-end gap-3">
                                <a href="/expenses/${t.id}/edit" class="text-xs text-violet-600 hover:text-violet-700 transition-colors">Edit</a>
                                <form method="POST" action="/expenses/${t.id}/delete" data-delete-form>
                                    <button type="submit" class="text-xs text-red-600 hover:text-red-700 transition-colors">Delete</button>
                                </form>
                            </div>
                        </td>
                    `;
                    tr.querySelector("[data-merchant]").textContent = t.expense_name;
                    if (t.note) tr.querySelector("[data-note]").textContent = t.note;
                    tr.querySelector("[data-delete-form]").addEventListener("submit", (e) => {
                        if (!confirm(`Delete "${t.expense_name}"? This can't be undone.`)) e.preventDefault();
                    });
                    body.appendChild(tr);
                });
            }
        }
        draw();
    }

    async function loadTransactions() {
        const transactions = await fetchTransactions();
        if (!transactions) return;
        renderTransactions(transactions);
    }

    loadTransactions();
})();
