const args = process.argv.slice(2);
const getOption = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};

const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
const token = process.env.SKILLFLOW_ADMIN_ACCESS_TOKEN;
const reference = getOption("--reference");
const email = getOption("--email");
const activate = args.includes("--activate");

if (!baseUrl || !token) {
  console.error("Configurez NEXT_PUBLIC_APP_URL et SKILLFLOW_ADMIN_ACCESS_TOKEN dans .env.local.");
  process.exit(2);
}
if (activate && !reference) {
  console.error("--activate exige --reference <référence-commande>.");
  process.exit(2);
}
if (reference && email) {
  console.error("Choisissez --reference ou --email, pas les deux.");
  process.exit(2);
}

const endpoint = new URL("/api/admin/payments/reconcile", baseUrl);
if (reference) endpoint.searchParams.set("reference", reference);
if (email) endpoint.searchParams.set("email", email);

const response = await fetch(activate ? new URL("/api/admin/payments/reconcile", baseUrl) : endpoint, {
  method: activate ? "POST" : "GET",
  headers: {
    Authorization: `Bearer ${token}`,
    ...(activate ? { "Content-Type": "application/json" } : {}),
  },
  ...(activate ? { body: JSON.stringify({ reference }) } : {}),
  cache: "no-store",
});
const payload = await response.json().catch(() => ({}));
console.log(JSON.stringify(payload, null, 2));
if (!response.ok) process.exitCode = 1;
