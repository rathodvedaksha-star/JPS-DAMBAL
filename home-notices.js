import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://tjybrmumnxulnqxpsxhi.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1APbA6E1TJaD0iWNIxojwQ_7fPG3LT7";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const host = document.getElementById("homeNoticeList");
const status = document.getElementById("homeNoticeStatus");
const refresh = document.getElementById("refreshHomeNotices");

function noticeCard(notice) {
  const card = document.createElement("article");
  card.style.cssText = "background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:20px;box-shadow:0 5px 18px rgba(18,50,91,.06);overflow-wrap:anywhere;";
  const badge = document.createElement("span");
  badge.textContent = notice.category || "General";
  badge.style.cssText = "display:inline-block;background:#eaf2ff;color:#1e5aa8;border-radius:999px;padding:4px 10px;font-size:.78rem;font-weight:700;";
  const title = document.createElement("h3");
  title.textContent = notice.title || "School Notice";
  title.style.cssText = "margin:12px 0 8px;color:#12325b;";
  const date = document.createElement("p");
  const stamp = notice.published_at || notice.created_at;
  date.textContent = stamp ? `Published ${new Date(stamp).toLocaleDateString("en-IN", {day:"numeric",month:"short",year:"numeric"})}` : "Recently published";
  date.style.cssText = "font-size:.82rem;color:#64748b;margin-bottom:10px;";
  const description = document.createElement("p");
  description.textContent = notice.description || "";
  description.style.cssText = "white-space:pre-wrap;color:#435168;margin-bottom:0;";
  card.append(badge, title, date, description);
  return card;
}

async function loadHomeNotices() {
  refresh.disabled = true;
  status.hidden = false;
  status.textContent = "Loading latest notices…";
  host.replaceChildren();
  const { data, error } = await supabase
    .from("school_notices")
    .select("id,title,description,category,notice_date,created_at,published_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(3);
  refresh.disabled = false;
  if (error) {
    console.error("Could not load school notices:", error);
    status.textContent = "Notices are temporarily unavailable. Please try refreshing.";
    return;
  }
  if (!data || data.length === 0) {
    status.textContent = "There are no published notices yet.";
    return;
  }
  data.forEach(item => host.appendChild(noticeCard(item)));
  status.hidden = true;
}
refresh.addEventListener("click", loadHomeNotices);
loadHomeNotices();
