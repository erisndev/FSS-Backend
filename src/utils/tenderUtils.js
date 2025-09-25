// utils/tenderUtils.js
import Tender from "../models/Tender.js";

/**
 * Close all tenders whose deadline has passed and are still active
 */
export const autoCloseTenders = async () => {
  try {
    const now = new Date();
    const tendersToClose = await Tender.find({
      status: "active",
      deadline: { $lt: now },
    });

    for (const tender of tendersToClose) {
      tender.status = "closed";
      await tender.save();
      console.log(`Tender "${tender.title}" auto-closed.`);
    }
  } catch (err) {
    console.error("Error auto-closing tenders:", err);
  }
};
