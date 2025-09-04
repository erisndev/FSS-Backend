// controllers/issuer.controller.js
import Tender from "../models/Tender.js";
import Application from "../models/Application.js";

export const getBiddersForMyTenders = async (req, res) => {
  try {
    const issuerId = req.user._id;

    // 1️⃣ Get all tenders created by this issuer
    const myTenders = await Tender.find({ createdBy: issuerId }).select(
      "_id title"
    );
    const tenderIds = myTenders.map((t) => t._id);

    // 2️⃣ Find applications for these tenders and populate bidder
    const applications = await Application.find({ tender: { $in: tenderIds } })
      .populate("bidder", "name email company role")
      .populate("tender", "title");

    // 3️⃣ Group by bidder
    const biddersMap = {};
    applications.forEach((app) => {
      const b = app.bidder;
      if (b) {
        if (!biddersMap[b._id])
          biddersMap[b._id] = { bidder: b, applications: [] };
        biddersMap[b._id].applications.push({
          _id: app._id,
          tender: app.tender,
          status: app.status,
          createdAt: app.createdAt,
        });
      }
    });

    res.json(Object.values(biddersMap)); // array of { bidder, applications }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
