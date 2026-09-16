const bcrypt = require("bcryptjs");
const pool = require("./src/config/db");

async function actualizarPasswords() {
  try {
    const [usuarios] = await pool.query(`
      SELECT id, nombre_usuario
      FROM usuario
      ORDER BY id
    `);

    for (const usuario of usuarios) {
      const hash = await bcrypt.hash("123", 10);

      await pool.query(
        `
        UPDATE usuario
        SET password_hash = ?
        WHERE id = ?
        `,
        [hash, usuario.id]
      );

      console.log(
        `✓ ${usuario.nombre_usuario} actualizado`
      );
    }

    console.log("");
    console.log("Todos los usuarios ahora usan: 123");
    console.log("Las contraseñas quedaron cifradas con bcrypt.");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
  }
}

actualizarPasswords();