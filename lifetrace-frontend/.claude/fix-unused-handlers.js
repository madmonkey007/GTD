const fs = require("fs");
const fp =
  "D:/manus/FreeTodo/lifetrace-frontend/apps/todo-detail/TodoDetail.tsx";
let c = fs.readFileSync(fp, "utf8");
const hasCRLF = c.includes("\r\n");
let n = c.replace(/\r\n/g, "\n");

// Remove handleToggleComplete
const old1 =
  '\tconst handleToggleComplete = async () => {\n\t\ttry {\n\t\t\tawait toggleTodoStatus(todo.id);\n\t\t} catch (err) {\n\t\t\tconsole.error("Failed to toggle status:", err);\n\t\t}\n\t};\n\n\t\t';

if (n.includes(old1)) {
  n = n.replace(old1, "\t\t");
  console.log("âœ?Removed handleToggleComplete");
} else {
  console.log("âœ?handleToggleComplete not found");
}

// Remove handleDeleteRequest
const old2 =
  '\n\t\tconst handleDeleteRequest = () => {\n\t\t\tsetShowDeleteConfirm(true);\n\t\t};';

if (n.includes(old2)) {
  n = n.replace(old2, "");
  console.log("âœ?Removed handleDeleteRequest");
} else {
  console.log("âœ?handleDeleteRequest not found");
}

const result = hasCRLF ? n.replace(/\n/g, "\r\n") : n;
fs.writeFileSync(fp, result, "utf8");
console.log("Saved");
