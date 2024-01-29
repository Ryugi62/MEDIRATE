const express = require("express");
const app = express();

const PORT = process.env.PORT || 3000;

// dist is the output folder for the build
app.use(express.static("dist"));

app.get("*", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
