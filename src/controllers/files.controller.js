import path from "path";
import fs from "fs";

// Download existing file
export const download = async (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ message: "Missing path" });

    const abs = path.resolve(filePath);
    if (!abs.startsWith(path.resolve("uploads"))) {
      return res.status(400).json({ message: "Invalid path" });
    }
    if (!fs.existsSync(abs))
      return res.status(404).json({ message: "File not found" });

    res.download(abs);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// Upload file
export const upload = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    res.json({ message: "File uploaded successfully", file: req.file });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
