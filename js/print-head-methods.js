// Paste this code into your browser console after the avatar loads
console.log("=== head methods and properties ===");
for (let k of Object.getOwnPropertyNames(head.__proto__)) {
  try {
    console.log(typeof head[k] === "function" ? "function: " + k : "property: " + k);
  } catch (e) {}
}
if (head.avatar) {
  console.log("=== head.avatar methods and properties ===");
  for (let k of Object.getOwnPropertyNames(head.avatar.__proto__)) {
    try {
      console.log(typeof head.avatar[k] === "function" ? "function: " + k : "property: " + k);
    } catch (e) {}
  }
  console.log("=== head.avatar direct keys ===");
  for (let k of Object.keys(head.avatar)) {
    try {
      console.log(typeof head.avatar[k] === "function" ? "function: " + k : "property: " + k);
    } catch (e) {}
  }
} 
