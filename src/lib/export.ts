import type { AiInsight, BudgetItem, BudgetLimit, BudgetMonth, Category, Expense, Household, HouseholdMember } from "../types";
import { spendingByCategory, spendingByPerson, totalBudget, totalBudgetItemMonthlyIncome, totalBudgetItemMonthlyPlannedExpenses, totalSpent } from "./budget";
import { currency } from "./format";

function downloadBlob(filename: string, content: BlobPart, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function exportTransactionsCsv(filename: string, expenses: Expense[]) {
  const rows = [
    ["Date", "Amount", "Category", "Added by", "Merchant", "Note"],
    ...expenses.map((expense) => [
      expense.spent_on,
      Number(expense.amount).toFixed(2),
      expense.category?.name ?? "",
      expense.profile?.display_name ?? expense.profile?.email ?? "",
      expense.merchant ?? "",
      expense.note ?? "",
    ]),
  ];

  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  downloadBlob(filename, csv, "text/csv;charset=utf-8");
}

export async function exportTransactionsExcel(filename: string, expenses: Expense[]) {
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.json_to_sheet(
    expenses.map((expense) => ({
      Date: expense.spent_on,
      Amount: Number(expense.amount),
      Category: expense.category?.name ?? "",
      "Added by": expense.profile?.display_name ?? expense.profile?.email ?? "",
      Merchant: expense.merchant ?? "",
      Note: expense.note ?? "",
    })),
  );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Transactions");
  XLSX.writeFile(workbook, filename);
}

export async function exportSummaryPdf(params: {
  filename: string;
  household: Household;
  monthLabel: string;
  budgetMonth: BudgetMonth | null;
  budgetItems?: BudgetItem[];
  categories: Category[];
  limits: BudgetLimit[];
  expenses: Expense[];
  members: HouseholdMember[];
  aiInsight: AiInsight | null;
}) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const manualPlanned = params.budgetItems?.length ? totalBudgetItemMonthlyPlannedExpenses(params.budgetItems) : 0;
  const manualIncome = params.budgetItems?.length ? totalBudgetItemMonthlyIncome(params.budgetItems) : 0;
  const planned = manualPlanned > 0 ? manualPlanned : totalBudget(params.budgetMonth, params.limits);
  const spent = totalSpent(params.expenses);
  const remaining = planned - spent;
  const totalIncome = manualIncome > 0 ? manualIncome : Number(params.budgetMonth?.total_income ?? 0);
  let y = 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("MoneyMates Monthly Summary", 14, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Household: ${params.household.name}`, 14, y);
  y += 7;
  doc.text(`Month: ${params.monthLabel}`, 14, y);
  y += 7;
  doc.text(`Total income: ${currency(totalIncome)}`, 14, y);
  y += 7;
  doc.text(`Total spent: ${currency(spent)}`, 14, y);
  y += 7;
  doc.text(`Remaining budget: ${currency(remaining)}`, 14, y);
  y += 11;

  doc.setFont("helvetica", "bold");
  doc.text("Spending by category", 14, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  spendingByCategory(params.expenses, params.categories, params.limits).forEach((item) => {
    doc.text(`${item.category}: ${currency(item.spent)} of ${currency(item.limit)}`, 16, y);
    y += 6;
  });

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.text("Spending by person", 14, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  spendingByPerson(params.expenses, params.members).forEach((item) => {
    doc.text(`${item.name}: ${currency(item.spent)}`, 16, y);
    y += 6;
  });

  const transactionsWithNotes = params.expenses.filter((expense) => expense.note?.trim());
  if (transactionsWithNotes.length) {
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.text("Transaction notes", 14, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    transactionsWithNotes.slice(0, 18).forEach((expense) => {
      if (y > 276) {
        doc.addPage();
        y = 18;
      }
      const label = `${expense.spent_on} ${expense.merchant || expense.category?.name || "Expense"}: ${expense.note ?? ""}`;
      const lines = doc.splitTextToSize(label, 178);
      doc.text(lines, 16, y);
      y += lines.length * 5 + 2;
    });
  }

  if (params.aiInsight) {
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.text("AI summary", 14, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(params.aiInsight.summary, 180);
    doc.text(lines, 16, y);
  }

  doc.save(params.filename);
}
