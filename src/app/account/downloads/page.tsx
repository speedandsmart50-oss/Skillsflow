import { redirect } from "next/navigation";

export default function DownloadPage() {
  redirect("/account?section=skills");
}
