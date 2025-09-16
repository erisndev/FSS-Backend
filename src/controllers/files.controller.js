export const uploadFile = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    res.json({
      message: "File uploaded successfully",
      file: {
        originalName: req.file.originalname,
        url: req.file.path,
        mimeType: req.file.mimetype,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const downloadFile = async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ message: "Missing file URL" });

    res.redirect(url); // Cloudinary handles download
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
