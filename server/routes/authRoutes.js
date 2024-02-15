const express = require("express");
const router = express.Router();
const db = require("../db"); // Ensure db is configured for database queries

/**
 * Compares the provided password with the stored hash.
 * Replace this with your actual password verification logic for production use.
 * @param {string} inputPassword User's input password
 * @param {string} storedHash Hash stored in the database
 * @returns {boolean} Result of the password verification
 */
function verifyPassword(inputPassword, storedHash) {
  console.log("inputPassword = " + inputPassword);
  console.log("storedHash = " + storedHash);

  // Placeholder for actual password verification logic
  return inputPassword === storedHash;
}

/**
 * Handles login attempts.
 */
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const query = "SELECT * FROM user_credentials WHERE username = TRIM(?)";
    const [rows] = await db.query(query, [username.trim()]);

    if (rows.length === 0) {
      // No user found or password does not match
      return res.status(401).send("Invalid username or password."); // Use 401 for authentication errors
    }

    console.log("1");

    const user = rows[0];
    if (!verifyPassword(password, user.encrypted_password)) {
      // Password does not match
      return res.status(401).send("Invalid username or password.");
    }

    console.log("2");

    // Authentication successful
    req.session.user = { id: user.id, username: user.username.trim() };

    // Exclude password from user details
    const userWithoutPassword = {
      username: user.username.trim(),
      realname: user.realname,
      organization: user.organization,
      role: user.role,
    };

    res.status(200).send(userWithoutPassword);
  } catch (error) {
    console.error("Server error during login:", error);
    res.status(500).send("Server error during login."); // Use generic message for server errors
  }
});

/**
 * Handles logout by destroying the session and redirecting to the login page.
 */
router.get("/logout", (req, res) => {
  if (req.session.user) {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).send("Error logging out.");
      }
      res.redirect("/login");
    });
  } else {
    res.redirect("/login"); // Redirect if not logged in
  }
});

module.exports = router;
