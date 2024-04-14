const express = require("express");
const db = require("../db");
const jwt = require("jsonwebtoken");
const authenticateToken = require("../jwt");

const router = express.Router();
require("dotenv").config();

function verifyPassword(inputPassword, storedHash) {
  // Replace this with your actual password verification logic
  return inputPassword === storedHash;
}

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const query = "SELECT * FROM users WHERE username = TRIM(?)";
    const [rows] = await db.query(query, [username.trim()]);

    if (rows.length === 0) {
      return res.status(401).send("Invalid username or password.");
    }

    const user = rows[0];
    if (!verifyPassword(password, user.password)) {
      return res.status(401).send("Invalid username or password.");
    }

    const token = jwt.sign(
      { id: user.id, username: user.username.trim() },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    const userWithoutPassword = {
      username: user.username.trim(),
      realname: user.realname,
      organization: user.organization,
      role: user.role,
      token: token,
      isAdministrator: user.role === "admin",
    };

    res.status(200).json(userWithoutPassword);
  } catch (error) {
    console.error("Server error during login:", error);
    res.status(500).send("Server error during login.");
  }
});

router.get("/logout", (req, res) => {
  if (req.session.user) {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).send("Logout error.");
      }
      res.redirect("/login");
    });
  } else {
    res.redirect("/login");
  }
});

router.post("/register", authenticateToken, async (req, res) => {
  const { username, password, realname, role } = req.body;

  try {
    if (req.user.role !== "admin") {
      return res.status(403).send("Unauthorized user.");
    }

    const query =
      "INSERT INTO users (username, password, realname, organization, role) VALUES (?, ?, ?, ?, ?)";
    await db.query(query, [username, password, realname, null, role]);
    res.status(200).send("success");
  } catch (error) {
    console.error("Server error during register:", error);
    res.status(500).send("Server error during register.");
  }
});

router.get("/user-list", authenticateToken, async (__req, res) => {
  try {
    const usersQuery = `SELECT id, username, realname FROM users`;
    const [users] = await db.query(usersQuery);

    res.status(200).json(users);
  } catch (error) {
    console.error("Unable to fetch user list due to server error:", error);
    res.status(500).send("Unable to fetch user list due to server error.");
  }
});

router.get("/:username", authenticateToken, async (req, res) => {
  const username = req.params.username;

  try {
    const query = "SELECT * FROM users WHERE username = TRIM(?)";
    const [rows] = await db.query(query, [username.trim()]);
    if (rows.length > 0) {
      return res.status(409).send("Duplicate username.");
    }
    res.status(200).send("success");
  } catch (error) {
    console.error("Server error during checkDuplicate:", error);
    res.status(500).send("Server error during checkDuplicate.");
  }
});

module.exports = router;
