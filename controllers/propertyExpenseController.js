import PropertyExpense from "../models/PropertyExpense.js";

// @desc Get expenses (optionally filter by property)
export const getExpenses = async (req, res) => {
  try {
    const filter = {};
    if (req.query.property) filter.property = req.query.property;

    const expenses = await PropertyExpense.find(filter)
      .populate("property", "name")
      .populate("splitBetween.tenant", "fullName")
      .sort({ date: -1 });
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Get single expense
export const getExpenseById = async (req, res) => {
  try {
    const expense = await PropertyExpense.findById(req.params.id)
      .populate("property", "name")
      .populate("splitBetween.tenant", "fullName");
    if (!expense) return res.status(404).json({ message: "Expense not found" });
    res.json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Create expense. If splitBetween is sent as an array of tenant IDs,
// the amount is split equally between them automatically.
export const createExpense = async (req, res) => {
  try {
    const { splitBetween, amount, ...rest } = req.body;

    let splitPayload = [];
    if (Array.isArray(splitBetween) && splitBetween.length > 0) {
      const shareAmount = Math.round((Number(amount) / splitBetween.length) * 100) / 100;
      splitPayload = splitBetween.map((tenantId) => ({ tenant: tenantId, shareAmount }));
    }

    const expense = await PropertyExpense.create({
      ...rest,
      amount,
      splitBetween: splitPayload,
    });
    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Update expense
export const updateExpense = async (req, res) => {
  try {
    const { splitBetween, amount, ...rest } = req.body;
    const updateData = { ...rest, amount };

    if (Array.isArray(splitBetween)) {
      const shareAmount = splitBetween.length > 0
        ? Math.round((Number(amount) / splitBetween.length) * 100) / 100
        : 0;
      updateData.splitBetween = splitBetween.map((tenantId) => ({ tenant: tenantId, shareAmount }));
    }

    const expense = await PropertyExpense.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });
    if (!expense) return res.status(404).json({ message: "Expense not found" });
    res.json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Delete expense
export const deleteExpense = async (req, res) => {
  try {
    const expense = await PropertyExpense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: "Expense not found" });
    await expense.deleteOne();
    res.json({ message: "Expense deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
