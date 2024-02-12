const express = require("express");
const router = express.Router();
const db = require("../db"); // Assuming db is properly set up for querying your database
const path = require("path"); // Used for serving the login page

// Function to compare password with stored hash
// Replace this with your actual password verification logic
function verifyPassword(inputPassword, storedHash) {
  return inputPassword == storedHash;
}

// Handle login attempts
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const trimmedUsername = username.trim();
    const query = "SELECT * FROM user_credentials WHERE TRIM(username) = ?";
    const [rows] = await db.query(query, [trimmedUsername]);

    if (rows.length > 0) {
      const user = rows[0]; // Assuming username is unique

      if (verifyPassword(password, user.encrypted_password)) {
        // Authentication successful
        req.session.user = { id: user.id, username: user.username };

        // Manually create a new user object without the encrypted_password
        const userWithoutPassword = {
          id: user.id,
          username: user.username,
          realname: user.realname,
          // Include any other user fields you want to return, except encrypted_password
          organization: user.organization,
        };

        res.send(userWithoutPassword);
      } else {
        // Password does not match
        res.send("Invalid username or password.");
      }
    } else {
      // No user found with the provided username
      res.send("Invalid username or password.");
    }
  } catch (error) {
    console.error("Server error during login:", error);
    res.status(500).send("Server error during login.");
  }
});

// Handle logout
router.get("/logout", (req, res) => {
  if (req.session.user) {
    req.session.destroy(() => {
      res.redirect("/login"); // Redirect to the login page after logout
    });
  } else {
    res.redirect("/login");
  }
});

module.exports = router;
