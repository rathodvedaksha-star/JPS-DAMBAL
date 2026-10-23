
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://tjybrmumnxulnqxpsxhi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_1APbA6E1TJaD0iWNIxojwQ_7fPG3LT7";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = id => document.getElementById(id);
const welcome = $("welcome");
const message = $("message");
const dashboard = $("dashboard");
const launcher = $("dashboardLauncher");
const backButton = $("backButton");
let adminUser = null;

function showStatus(id, text) {
  $(id).textContent = text || "";
}

function setBusy(button, busy, busyText, normalText) {
  button.disabled = busy;
  button.textContent = busy ? busyText : normalText;
}

function makeTable(headers, rows) {
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  headers.forEach(header => {
    const th = document.createElement("th");
    th.textContent = header;
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  rows.forEach(values => {
    const row = document.createElement("tr");
    values.forEach(value => {
      const td = document.createElement("td");
      td.textContent = value == null ? "—" : String(value);
      row.appendChild(td);
    });
    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  return table;
}

async function loadActiveSubjects() {
  const select = $("subjectName");
  const { data, error } = await supabase
    .from("school_subjects")
    .select("name")
    .eq("is_active", true)
    .order("name");

  select.replaceChildren(new Option(error ? "Could not load subjects" : "Select a subject", ""));

  if (error) {
    console.error("Subject loading failed:", error.message);
    return;
  }

  (data || []).forEach(subject => select.add(new Option(subject.name, subject.name)));
}

function resetNoticeForm() {
  $("noticeForm").reset();
  $("noticeEditId").value = "";
  $("noticePublished").checked = true;
  $("noticeDate").value = new Date().toISOString().slice(0, 10);
  $("saveNoticeButton").textContent = "Save Notice";
  showStatus("noticeFormStatus", "");
}

function safeNoticeText(value) {
  const node = document.createElement("span");
  node.textContent = value == null ? "" : String(value);
  return node;
}

async function loadAdminNotices() {
  if (!adminUser) return;
  showStatus("noticeListStatus", "Loading notices…");
  const { data, error } = await supabase
    .from("school_notices")
    .select("id,title,description,category,notice_date,is_published,created_at,published_at")
    .order("created_at", { ascending: false });
  if (error) {
    showStatus("noticeListStatus", "Could not load notices: " + error.message);
    return;
  }
  const host = $("adminNoticeList");
  host.replaceChildren();
  if (!data?.length) {
    host.textContent = "No notices yet. Use the form above to create the first notice.";
    showStatus("noticeListStatus", "");
    return;
  }
  data.forEach(notice => {
    const box = document.createElement("article");
    box.style.cssText = "border:1px solid #dbe3ed;border-radius:10px;padding:14px;margin:12px 0;overflow-wrap:anywhere;";
    const title = document.createElement("h4"); title.textContent = notice.title;
    const meta = document.createElement("p");
    meta.textContent = `${notice.category || "General"} · ${notice.is_published ? "Published" : "Unpublished"} · Notice date: ${notice.notice_date || "—"}`;
    const desc = document.createElement("p"); desc.textContent = notice.description;
    const actions = document.createElement("div"); actions.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;";
    const edit = document.createElement("button"); edit.type = "button"; edit.textContent = "Edit";
    edit.addEventListener("click", () => {
      $("noticeEditId").value = notice.id;
      $("noticeTitle").value = notice.title || "";
      $("noticeCategory").value = notice.category || "General";
      $("noticeDate").value = notice.notice_date || new Date().toISOString().slice(0,10);
      $("noticeDescription").value = notice.description || "";
      $("noticePublished").checked = !!notice.is_published;
      $("saveNoticeButton").textContent = "Update Notice";
      showStatus("noticeFormStatus", "Editing notice: " + notice.title);
      $("noticeForm").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    const toggle = document.createElement("button"); toggle.type = "button"; toggle.textContent = notice.is_published ? "Unpublish" : "Publish";
    toggle.addEventListener("click", async () => {
      const nextPublished = !notice.is_published;
      const update = { is_published: nextPublished, updated_at: new Date().toISOString() };
      if (nextPublished) update.published_at = new Date().toISOString();
      const { error: updateError } = await supabase.from("school_notices").update(update).eq("id", notice.id);
      if (updateError) showStatus("noticeListStatus", "Could not update notice: " + updateError.message);
      else { showStatus("noticeListStatus", nextPublished ? "Notice published." : "Notice unpublished."); await loadAdminNotices(); }
    });
    const del = document.createElement("button"); del.type = "button"; del.textContent = "Delete";
    del.addEventListener("click", async () => {
      if (!confirm(`Delete the notice “${notice.title}”? This cannot be undone.`)) return;
      const { error: deleteError } = await supabase.from("school_notices").delete().eq("id", notice.id);
      if (deleteError) showStatus("noticeListStatus", "Could not delete notice: " + deleteError.message);
      else { showStatus("noticeListStatus", "Notice deleted."); await loadAdminNotices(); }
    });
    actions.append(edit, toggle, del); box.append(title, meta, desc, actions); host.append(box);
  });
  showStatus("noticeListStatus", `${data.length} notice(s) loaded. Published notices appear newest-first on the homepage.`);
}

$("noticeDate").value = new Date().toISOString().slice(0, 10);
$("noticeForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!adminUser) return showStatus("noticeFormStatus", "Admin access has not been verified.");
  const button = $("saveNoticeButton");
  button.disabled = true;
  const id = $("noticeEditId").value;
  const isPublished = $("noticePublished").checked;
  const now = new Date().toISOString();
  const payload = {
    title: $("noticeTitle").value.trim(),
    category: $("noticeCategory").value,
    notice_date: $("noticeDate").value,
    description: $("noticeDescription").value.trim(),
    is_published: isPublished,
    updated_at: now
  };
  if (isPublished) payload.published_at = now;
  let result;
  if (id) result = await supabase.from("school_notices").update(payload).eq("id", id);
  else { payload.created_by = adminUser.id; result = await supabase.from("school_notices").insert(payload); }
  button.disabled = false;
  if (result.error) {
    showStatus("noticeFormStatus", "Could not save notice: " + result.error.message);
    return;
  }
  showStatus("noticeFormStatus", isPublished ? "Notice saved and published." : "Notice saved as unpublished.");
  resetNoticeForm();
  await loadAdminNotices();
});
$("cancelNoticeEdit").addEventListener("click", resetNoticeForm);
$("reloadNoticesButton").addEventListener("click", loadAdminNotices);

async function checkAdmin() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;

  if (!user) {
    welcome.textContent = "You are not signed in.";
    message.textContent = "Please sign in using your admin account. ";
    const link = document.createElement("a");
    link.href = "admin-login.html";
    link.textContent = "Go to Admin Login";
    message.appendChild(link);
    return;
  }

  const { data: roleData, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleError) throw roleError;

  if (roleData?.role !== "admin") {
    welcome.textContent = "Admin access not confirmed.";
    message.textContent = "This account does not have the admin role.";
    return;
  }

  adminUser = user;
  welcome.textContent = "Welcome, " + (user.email || "Administrator");
  message.textContent = "Admin access verified successfully.";
  launcher.classList.remove("hidden");

  try {
    await Promise.all([loadStudents(), loadActiveSubjects()]);
  } catch (err) {
    console.error("Could not load initial dashboard data:", err);
    message.textContent = "Admin access verified, but some data could not load: " + err.message;
  }

  const requestedPage = new URLSearchParams(location.search).get("page");
  if (requestedPage) openPage(requestedPage);
}

function openPage(page) {
  if (page === "subjects") {
    location.href = "manage-subjects.html";
    return;
  }
  if (page === "gallery") {
    location.href = "manage-gallery.html";
    return;
  }

  const feature = dashboard.querySelector('[data-feature="' + page + '"]');
  if (!feature) {
    showStatus("message", "This dashboard section could not be found.");
    return;
  }

  launcher.classList.add("hidden");
  dashboard.classList.remove("hidden");
  dashboard.querySelectorAll("[data-feature]").forEach(card => {
    card.classList.toggle("hidden", card !== feature);
  });
  backButton.classList.remove("hidden");
  history.replaceState(null, "", "admin-dashboard.html?page=" + encodeURIComponent(page));

  if (page === "attendance") loadAttendanceRecords();
  if (page === "fees") loadFeeRecords();
  if (page === "notices") loadAdminNotices();
}

function showHome() {
  dashboard.querySelectorAll("[data-feature]").forEach(card => card.classList.remove("hidden"));
  dashboard.classList.add("hidden");
  launcher.classList.remove("hidden");
  backButton.classList.add("hidden");
  history.replaceState(null, "", "admin-dashboard.html");
}

launcher.querySelectorAll("[data-page]").forEach(button => {
  button.addEventListener("click", () => openPage(button.dataset.page));
});
backButton.addEventListener("click", showHome);
$("openSubjects").addEventListener("click", () => location.href = "manage-subjects.html");
$("openGallery").addEventListener("click", () => location.href = "manage-gallery.html");

async function invokeUserCreation(body) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.access_token) throw new Error("Your session expired. Please sign in again.");

  const { data, error } = await supabase.functions.invoke("manage-school-users", {
    body,
    headers: { Authorization: "Bearer " + session.access_token }
  });

  if (error) {
    let detail = error.message;
    if (error.context) {
      try {
        const result = await error.context.json();
        if (result?.error) detail = result.error;
      } catch {}
    }
    throw new Error(detail);
  }

  if (data?.error) throw new Error(data.error);
  return data;
}

async function loadStudents() {
  const { data, error } = await supabase
    .from("students")
    .select("id, full_name, admission_number, class_name")
    .order("full_name");

  if (error) throw error;
  const students = data || [];
  
const classSelect = $("attendanceClass");

if (classSelect) {
  const previousClass = classSelect.value;
  const classes = [...new Set(
    students.map(student => student.class_name).filter(Boolean)
  )].sort();

  classSelect.replaceChildren(new Option("Select a class", ""));

  classes.forEach(className => {
    classSelect.add(new Option(className, className));
  });

  if (classes.includes(previousClass)) {
    classSelect.value = previousClass;
  }
}

const viewClassSelect = $("attendanceViewClass");
if (viewClassSelect) {
  const previousViewClass = viewClassSelect.value;
  const classes = [...new Set(
    students.map(student => student.class_name).filter(Boolean)
  )].sort();

  viewClassSelect.replaceChildren(new Option("All classes", ""));
  classes.forEach(className => {
    viewClassSelect.add(new Option(className, className));
  });

  if (classes.includes(previousViewClass)) {
    viewClassSelect.value = previousViewClass;
  }
}

  // Populate every student dropdown, including the Fees section.
  for (const id of ["attendanceStudent", "marksStudent", "resultsStudent", "feeStudent"]) {
    const select = $(id);
    if (!select) continue;
    const previousValue = select.value;
    select.replaceChildren();
    const option = document.createElement("option");
    option.value = "";
    option.textContent = id === "resultsStudent" ? "All students" : (students.length ? "Select a student" : "No students found");
    select.appendChild(option);

    students.forEach(student => {
      const opt = document.createElement("option");
      opt.value = student.id;
      opt.textContent = `${student.full_name} (${student.admission_number || "No admission number"})${student.class_name ? " - " + student.class_name : ""}`;
      select.appendChild(opt);
    });
    if (students.some(student => student.id === previousValue)) select.value = previousValue;
  }

  // Keep the Fees class filter populated before fee records are refreshed.
  feeStudentsCache = students;
  populateFeeClassFilter();
}

$("studentForm").addEventListener("submit", async e => {
  e.preventDefault();
  showStatus("studentMessage", "");
  if (!adminUser) return showStatus("studentMessage", "Admin access has not been verified.");

  const button = $("createStudentButton");
  setBusy(button, true, "Creating student...", "Create Student");

  try {
    const body = {
      email: $("studentEmail").value.trim(),
      password: $("studentPassword").value,
      role: "student",
      admission_number: $("admissionNumber").value.trim(),
      full_name: $("studentName").value.trim(),
      class_name: $("studentClass").value.trim(),
      parent_name: $("parentName").value.trim(),
      parent_phone: $("parentPhone").value.trim()
    };

    if (body.password.length < 12) throw new Error("Password must be at least 12 characters.");
    await invokeUserCreation(body);
    showStatus("studentMessage", "Student account and profile created successfully.");
    $("studentForm").reset();
    await loadStudents();
  } catch (err) {
    showStatus("studentMessage", "Could not create student: " + (err.message || "Unknown error"));
  } finally {
    setBusy(button, false, "", "Create Student");
  }
});

$("createAdminForm").addEventListener("submit", async e => {
  e.preventDefault();
  showStatus("createAdminMessage", "");
  if (!adminUser) return showStatus("createAdminMessage", "Please sign in with an existing admin account.");

  const button = $("createAdminButton");
  setBusy(button, true, "Creating admin...", "Create Admin Account");

  try {
    const fullName = $("newAdminName").value.trim();
    const email = $("newAdminEmail").value.trim();
    const password = $("newAdminPassword").value;
    if (!fullName || !email || password.length < 12) {
      throw new Error("Enter a name, valid email, and password of at least 12 characters.");
    }

    await invokeUserCreation({ email, password, role: "admin", full_name: fullName });
    showStatus("createAdminMessage", "Admin account created successfully with the admin role.");
    $("createAdminForm").reset();
  } catch (err) {
    showStatus("createAdminMessage", "Could not create admin: " + (err.message || "Unknown error"));
  } finally {
    setBusy(button, false, "", "Create Admin Account");
  }
});

$("marksForm").addEventListener("submit", async e => {
  e.preventDefault();
  showStatus("marksMessage", "");

  const studentId = $("marksStudent").value;
  const examName = $("examName").value.trim();
  const subject = $("subjectName").value.trim();
  const marksObtained = Number($("marksObtained").value);
  const maxMarks = Number($("maxMarks").value);

  if (!studentId) return showStatus("marksMessage", "Please select a student.");
  if (!examName || !subject || !Number.isFinite(marksObtained) || !Number.isFinite(maxMarks) ||
      marksObtained < 0 || maxMarks <= 0 || marksObtained > maxMarks) {
    return showStatus("marksMessage", "Enter valid marks. Obtained marks cannot exceed maximum marks.");
  }

  const button = $("saveMarksButton");
  setBusy(button, true, "Saving...", "Save Marks");

  try {
    const { error } = await supabase.from("marks").insert({
      student_id: studentId,
      exam_name: examName,
      subject,
      marks_obtained: marksObtained,
      max_marks: maxMarks
    });
    if (error) throw error;
    showStatus("marksMessage", "Marks saved successfully.");
    $("marksForm").reset();
  } catch (err) {
    showStatus("marksMessage", "Could not save marks: " + err.message);
  } finally {
    setBusy(button, false, "", "Save Marks");
  }
});

$("viewStudentResults").addEventListener("click", async () => {
  const studentId = $("resultsStudent").value;
  showStatus("resultsMessage", "Loading results...");
  $("resultsList").replaceChildren();

  try {
    let query = supabase.from("marks")
      .select("exam_name, subject, marks_obtained, max_marks, student_id, students(full_name, admission_number, class_name)")
      .order("exam_name");
    if (studentId) query = query.eq("student_id", studentId);

    const { data, error } = await query;
    if (error) throw error;
    if (!data?.length) {
      $("resultsList").textContent = "No results found.";
      showStatus("resultsMessage", "0 results found.");
      return;
    }

    const rows = data.map(r => [
      r.students?.full_name || "Unknown",
      r.students?.admission_number || "—",
      r.students?.class_name || "—",
      r.exam_name,
      r.subject,
      `${r.marks_obtained} / ${r.max_marks}`,
      `${((Number(r.marks_obtained) / Number(r.max_marks)) * 100).toFixed(1)}%`
    ]);

    $("resultsList").appendChild(makeTable(
      ["Student", "Admission No.", "Class", "Exam", "Subject", "Marks", "Percentage"], rows
    ));
    showStatus("resultsMessage", `${data.length} result(s) found.`);
  } catch (err) {
    showStatus("resultsMessage", "Could not load results: " + err.message);
  }
});

$("attendanceForm").addEventListener("submit", async e => {
  e.preventDefault();
  showStatus("attendanceMessage", "");

  const student_id = $("attendanceStudent").value;
  const attendance_date = $("attendanceDate").value;
  const status = $("attendanceStatus").value;
  if (!student_id || !attendance_date) return showStatus("attendanceMessage", "Please select a student and date.");

  const button = $("saveAttendanceButton");
  setBusy(button, true, "Saving...", "Save Attendance");

  try {
    const { error } = await supabase.from("attendance").upsert(
      { student_id, attendance_date, status },
      { onConflict: "student_id,attendance_date" }
    );
    if (error) throw error;
    showStatus("attendanceMessage", "Attendance saved successfully.");
    await loadAttendanceRecords();
  } catch (err) {
    showStatus("attendanceMessage", "Could not save attendance: " + err.message);
  } finally {
    setBusy(button, false, "", "Save Attendance");
  }
});

async function loadAttendanceRecords() {
  const date = $("attendanceViewDate").value;
  const className = $("attendanceViewClass")?.value || "";
  const recordsElement = $("attendanceRecords");

  if (!date) {
    showStatus("attendanceViewMessage", "Please choose a date.");
    return;
  }

  showStatus("attendanceViewMessage", "Loading attendance...");
  recordsElement.replaceChildren();

  try {
    const { data, error } = await supabase
      .from("attendance")
      .select("attendance_date,status,students(full_name,admission_number,class_name)")
      .eq("attendance_date", date)
      .order("status");

    if (error) throw error;

    const filteredData = (data || []).filter(record => {
      if (!className) return true;
      return record.students?.class_name === className;
    });

    if (!filteredData.length) {
      recordsElement.textContent =
        "No attendance records found for this date and class.";
      showStatus("attendanceViewMessage", "0 records found.");
      return;
    }

    const classes = {};
    filteredData.forEach(record => {
      const studentClass = record.students?.class_name || "Unknown class";
      if (!classes[studentClass]) classes[studentClass] = [];

      classes[studentClass].push([
        record.students?.full_name || "Unknown",
        record.students?.admission_number || "—",
        record.status
      ]);
    });

    Object.keys(classes).sort().forEach(studentClass => {
      const heading = document.createElement("h4");
      heading.textContent = studentClass;
      recordsElement.appendChild(heading);
      recordsElement.appendChild(
        makeTable(["Student", "Admission No.", "Status"], classes[studentClass])
      );
    });

    showStatus(
      "attendanceViewMessage",
      `${filteredData.length} record(s) found for ${date}.`
    );
  } catch (err) {
    showStatus(
      "attendanceViewMessage",
      "Could not load attendance: " + err.message
    );
  }
}

$("viewAttendanceButton").addEventListener("click", loadAttendanceRecords);

async function loadClassAttendance() {
  const className = $("attendanceClass").value;
  const date = $("classAttendanceDate").value;
  const list = $("classAttendanceList");

  showStatus("classAttendanceMessage", "");
  list.replaceChildren();

  if (!className || !date) {
    showStatus("classAttendanceMessage", "Please select a class and date.");
    return;
  }

  showStatus("classAttendanceMessage", "Loading students...");

  try {
    const { data: students, error } = await supabase
      .from("students")
      .select("id, full_name, admission_number, class_name")
      .eq("class_name", className)
      .order("full_name");

    if (error) throw error;

    if (!students?.length) {
      showStatus("classAttendanceMessage", "No students found in this class.");
      return;
    }

    const { data: saved, error: savedError } = await supabase
      .from("attendance")
      .select("student_id, status")
      .eq("attendance_date", date)
      .in("student_id", students.map(s => s.id));

    if (savedError) throw savedError;

    const savedByStudent = new Map(
      (saved || []).map(record => [record.student_id, record.status])
    );

    const table = document.createElement("table");
    table.innerHTML = `
      <thead>
        <tr>
          <th>Student</th>
          <th>Admission No.</th>
          <th>Attendance</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector("tbody");

    students.forEach(student => {
      const row = document.createElement("tr");
      const nameCell = document.createElement("td");
      const admissionCell = document.createElement("td");
      const statusCell = document.createElement("td");

      nameCell.textContent = student.full_name;
      admissionCell.textContent = student.admission_number || "—";

      const buttons = document.createElement("div");
buttons.className = "attendance-buttons";

const existingStatus = savedByStudent.get(student.id);
const currentStatus =
  typeof existingStatus === "string"
    ? existingStatus
    : existingStatus?.status || "";

["Present", "Absent"].forEach((status) => {
  const button = document.createElement("button");

  button.type = "button";
  button.textContent = status;
  button.className = "attendance-choice";
  button.dataset.studentId = student.id;
  button.dataset.status = status;

  if (currentStatus === status) {
    button.classList.add("selected");
  }

  button.addEventListener("click", () => {
    buttons.querySelectorAll("button").forEach((item) => {
      item.classList.remove("selected");
    });
    button.classList.add("selected");
  });

  buttons.appendChild(button);
});

statusCell.appendChild(buttons);
      row.append(nameCell, admissionCell, statusCell);
      tbody.appendChild(row);
    });

    list.appendChild(table);
    showStatus(
      "classAttendanceMessage",
      `${students.length} students loaded. Review each status before saving.`
    );
  } catch (err) {
    showStatus("classAttendanceMessage", "Could not load class: " + err.message);
  }
}

$("loadClassAttendanceButton").addEventListener("click", loadClassAttendance);

$("saveClassAttendanceButton").addEventListener("click", async () => {
  const date = $("classAttendanceDate").value;

  const selectedButtons = [
    ...$("classAttendanceList").querySelectorAll(
      ".attendance-choice.selected"
    )
  ];

  const allButtons = [
    ...$("classAttendanceList").querySelectorAll(".attendance-choice")
  ];

  const studentIds = [...new Set(
    allButtons.map(button => button.dataset.studentId)
  )];

  if (!date || studentIds.length === 0) {
    showStatus("classAttendanceMessage", "Load a class and date first.");
    return;
  }

  const selectedByStudent = new Map(
    selectedButtons.map(button => [
      button.dataset.studentId,
      button.dataset.status
    ])
  );

  if (
    studentIds.some(id => !selectedByStudent.has(id)) ||
    studentIds.some(id =>
      !["Present", "Absent"].includes(selectedByStudent.get(id))
    )
  ) {
    showStatus(
      "classAttendanceMessage",
      "Choose Present or Absent for every student."
    );
    return;
  }

  const button = $("saveClassAttendanceButton");
  setBusy(button, true, "Saving attendance...", "Save Whole-Class Attendance");

  try {
    const records = studentIds.map(studentId => ({
      student_id: studentId,
      attendance_date: date,
      status: selectedByStudent.get(studentId)
    }));

    const { error } = await supabase
      .from("attendance")
      .upsert(records, {
        onConflict: "student_id,attendance_date"
      });

    if (error) throw error;

    showStatus(
      "classAttendanceMessage",
      `Attendance saved for ${records.length} students.`
    );

    if ($("attendanceViewDate")) {
      $("attendanceViewDate").value = date;
      await loadAttendanceRecords();
    }
  } catch (err) {
    showStatus(
      "classAttendanceMessage",
      "Could not save attendance: " + err.message
    );
  } finally {
    setBusy(button, false, "", "Save Whole-Class Attendance");
  }
});
$("loadEnquiries").addEventListener("click", async () => {
  const button = $("loadEnquiries");
  setBusy(button, true, "Loading...", "Load Enquiries");
  showStatus("enquiryStatus", "Loading enquiries...");
  $("enquiriesList").replaceChildren();

  try {
    const { data, error } = await supabase.from("school_enquiries")
      .select("id,name,email,phone,subject,message,created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;

    if (!data?.length) {
      $("enquiriesList").textContent = "No enquiries found.";
      showStatus("enquiryStatus", "0 enquiries found.");
      return;
    }

    data.forEach(enquiry => {
      const card = document.createElement("article");
      card.style.cssText = "border:1px solid #cbd5e1;border-radius:10px;padding:14px;margin:12px 0";
      const title = document.createElement("h4");
      title.textContent = enquiry.name || "Unnamed visitor";
      card.appendChild(title);

      [
        ["Email", enquiry.email],
        ["Phone", enquiry.phone],
        ["Enquiry type", enquiry.subject],
        ["Message", enquiry.message],
        ["Submitted", enquiry.created_at ? new Date(enquiry.created_at).toLocaleString() : "Not available"]
      ].forEach(([label, value]) => {
        const p = document.createElement("p");
        p.textContent = `${label}: ${value || "Not provided"}`;
        p.style.overflowWrap = "anywhere";
        card.appendChild(p);
      });

      const phone = (enquiry.phone || "").replace(/\D/g, "");
      const wa = phone.length === 10 ? "91" + phone : phone;
      if (wa.length >= 10 && wa.length <= 15) {
        const a = document.createElement("a");
        a.className = "whatsapp";
        a.href = "https://wa.me/" + wa + "?text=" + encodeURIComponent(
          `Hello ${enquiry.name || "Parent"}, thank you for contacting Jnyanabindu Public School, Dambal. We received your enquiry about ${enquiry.subject || "your request"}. How can we help you?`
        );
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = "💬 Contact on WhatsApp";
        card.appendChild(a);
      }
      $("enquiriesList").appendChild(card);
    });
    showStatus("enquiryStatus", `${data.length} enquiry(s) loaded.`);
  } catch (err) {
    showStatus("enquiryStatus", "Could not load enquiries: " + err.message);
  } finally {
    setBusy(button, false, "", "Load Enquiries");
  }
});

$("loadKindergartenEnquiries").addEventListener("click", async () => {
  const button = $("loadKindergartenEnquiries");
  const status = $("kgEnquiryStatus");
  const list = $("kgEnquiriesList");
  setBusy(button, true, "Loading...", "Load Admission Enquiries");
  status.textContent = "Loading admission enquiries...";
  list.replaceChildren();

  try {
    const { data, error } = await supabase.from("kindergarten_enquiries")
      .select("parent_name, phone, child_name, date_of_birth, applying_for, previous_school, message, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;

    if (!data?.length) {
      list.textContent = "No kindergarten admission enquiries found.";
      status.textContent = "0 enquiries found.";
      return;
    }

    data.forEach(item => {
      const card = document.createElement("article");
      card.style.cssText = "border:1px solid #cbd5e1;border-radius:10px;padding:14px;margin:12px 0;overflow-wrap:anywhere";
      const heading = document.createElement("h4");
      heading.textContent = item.child_name || "Child name not provided";
      card.appendChild(heading);

      [
        ["Parent / Guardian", item.parent_name],
        ["Phone", item.phone],
        ["Class", item.applying_for],
        ["Date of birth", item.date_of_birth],
        ["Previous school", item.previous_school],
        ["Message", item.message],
        ["Submitted", item.created_at ? new Date(item.created_at).toLocaleString() : "Not available"]
      ].forEach(([label, value]) => {
        const p = document.createElement("p");
        p.textContent = label + ": " + (value || "Not provided");
        card.appendChild(p);
      });

      const phone = (item.phone || "").replace(/\D/g, "");
      const wa = phone.length === 10 ? "91" + phone : phone;
      if (wa.length >= 10 && wa.length <= 15) {
        const link = document.createElement("a");
        link.className = "whatsapp";
        link.href = "https://wa.me/" + wa;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Contact Parent on WhatsApp";
        card.appendChild(link);
      }
      list.appendChild(card);
    });
    status.textContent = data.length + " admission enquiry(s) loaded.";
  } catch (err) {
    console.error("Could not load kindergarten enquiries:", err);
    status.textContent = "Could not load enquiries: " + err.message;
  } finally {
    setBusy(button, false, "", "Load Admission Enquiries");
  }
});


// Fee management (kept within the existing admin dashboard script)
let feeStudentsCache = [];
let feeRecordsCache = [];

function money(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0));
}
function feeToday() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function feeStatus(record) {
  const total = Number(record.amount || 0);
  const paid = Number(record.amount_paid || 0);
  if (total > 0 && paid >= total) return "paid";
  if (paid > 0) return "partially_paid";
  if (record.due_date && record.due_date < feeToday()) return "overdue";
  return "pending";
}
function feeStatusLabel(status) {
  return ({paid:"Paid", pending:"Pending", partially_paid:"Partially Paid", overdue:"Overdue"})[status] || status;
}
function feeParentPhone(student) {
  return String(student?.parent_phone || "").replace(/\D/g, "");
}
function populateFeeClassFilter() {
  const select = $("feeClassFilter");
  if (!select) return;
  const old = select.value;
  const classes = [...new Set(feeStudentsCache.map(s => s.class_name).filter(Boolean))].sort((a,b)=>a.localeCompare(b, undefined, {numeric:true}));
  select.replaceChildren(new Option("All classes", ""));
  classes.forEach(c => select.add(new Option(c, c)));
  if (classes.includes(old)) select.value = old;
}
function feeMessageText(record, student) {
  const balance = Math.max(0, Number(record.amount || 0) - Number(record.amount_paid || 0));
  return `Dear Parent/Guardian, this is a reminder from Jnyanabindu Public School (JPS Dambal) regarding ${student?.full_name || "your child"}. Fee: ${record.description}. Total: ${money(record.amount)}; paid: ${money(record.amount_paid)}; balance: ${money(balance)}${record.due_date ? "; due date: " + record.due_date : ""}. Please contact the school office if you have already paid.`;
}
function safeLink(href, label, className) {
  const a = document.createElement("a");
  a.href = href; a.textContent = label; a.className = className || "";
  a.target = "_blank"; a.rel = "noopener noreferrer";
  return a;
}
function renderFeeRecords() {
  const host = $("feeRecords");
  if (!host) return;
  host.replaceChildren();
  const search = ($("feeSearch")?.value || "").trim().toLowerCase();
  const className = $("feeClassFilter")?.value || "";
  const wantedStatus = $("feeStatusFilter")?.value || "";
  const joined = feeRecordsCache.map(r => ({...r, student: feeStudentsCache.find(s => s.id === r.student_id)}));
  const filtered = joined.filter(r => {
    const st = feeStatus(r);
    const haystack = `${r.student?.full_name || ""} ${r.student?.admission_number || ""} ${r.description || ""}`.toLowerCase();
    return (!className || r.student?.class_name === className) &&
      (!wantedStatus || st === wantedStatus) && (!search || haystack.includes(search));
  });
  const total = feeRecordsCache.reduce((sum,r)=>sum+Number(r.amount||0),0);
  const paid = feeRecordsCache.reduce((sum,r)=>sum+Math.min(Number(r.amount||0),Number(r.amount_paid||0)),0);
  $("feeTotalAmount").textContent = money(total);
  $("feeCollectedAmount").textContent = money(paid);
  $("feePendingAmount").textContent = money(Math.max(0,total-paid));
  $("feeOverdueCount").textContent = feeRecordsCache.filter(r=>feeStatus(r)==="overdue").length;
  if (!filtered.length) {
    host.textContent = feeRecordsCache.length ? "No fee records match these filters." : "No fee records found yet.";
    showStatus("feeRecordsMessage", `${feeRecordsCache.length} total fee record(s); 0 match the current filters.`);
    return;
  }
  filtered.forEach(record => {
    const student = record.student || {};
    const status = feeStatus(record);
    const balance = Math.max(0, Number(record.amount||0)-Number(record.amount_paid||0));
    const card = document.createElement("article");
    card.className = "fee-record";
    const header = document.createElement("div"); header.className = "fee-record-header";
    const title = document.createElement("div");
    const h = document.createElement("h4"); h.textContent = student.full_name || "Unknown student"; title.appendChild(h);
    const sub = document.createElement("p");
    sub.textContent = `${student.admission_number || "No admission number"}${student.class_name ? " · " + student.class_name : ""} · ${record.description || "Fee"}`;
    title.appendChild(sub);
    const badge = document.createElement("span"); badge.className = `fee-badge ${status}`; badge.textContent = feeStatusLabel(status);
    header.append(title,badge); card.appendChild(header);
    const details = document.createElement("div"); details.className = "fee-detail-grid";
    [[ "Total fee",money(record.amount) ],["Amount paid",money(record.amount_paid)],["Balance",money(balance)],["Due date",record.due_date || "Not set"],["Last record update",record.created_at ? new Date(record.created_at).toLocaleDateString() : "Not available"]].forEach(([label,value])=>{
      const d=document.createElement("div"); const small=document.createElement("small"); small.textContent=label;
      const strong=document.createElement("strong"); strong.textContent=value; d.append(small,strong); details.appendChild(d);
    });
    card.appendChild(details);
    const actions = document.createElement("div"); actions.className = "fee-actions";
    const edit = document.createElement("button"); edit.type="button"; edit.className="fee-edit"; edit.textContent="Edit fee";
    edit.addEventListener("click",()=>beginFeeEdit(record)); actions.appendChild(edit);
    const phone = feeParentPhone(student);
    if (balance > 0 && phone.length >= 10) {
      const waPhone = phone.length === 10 ? "91" + phone : phone;
      actions.appendChild(safeLink("https://wa.me/"+waPhone+"?text="+encodeURIComponent(feeMessageText(record,student)),"WhatsApp reminder","fee-whatsapp"));
      actions.appendChild(safeLink("sms:"+phone+"?body="+encodeURIComponent(feeMessageText(record,student)),"Text / SMS","fee-sms"));
      const call = document.createElement("a"); call.href="tel:"+phone; call.textContent="Call parent"; call.className="fee-call"; actions.appendChild(call);
    }
    card.appendChild(actions);
    const hint=document.createElement("p"); hint.className="note muted"; hint.textContent=balance>0 ? "Reminder links are available if a parent phone number is saved." : "No outstanding balance for this fee record.";
    card.appendChild(hint);
    host.appendChild(card);
  });
  showStatus("feeRecordsMessage", `${filtered.length} fee record(s) shown (${feeRecordsCache.length} total).`);
}
function beginFeeEdit(record) {
  $("feeEditId").value = record.id;
  $("feeStudent").value = record.student_id;
  $("feeDescription").value = record.description || "";
  $("feeAmount").value = Number(record.amount || 0);
  $("feeAmountPaid").value = Number(record.amount_paid || 0);
  $("feeDueDate").value = record.due_date || "";
  $("feeStatus").value = feeStatus(record);
  $("feeFormHeading").textContent = "Edit Fee Record";
  $("saveFeeButton").textContent = "Update Fee";
  $("cancelFeeEditButton").classList.remove("hidden");
  $("feeForm").scrollIntoView({behavior:"smooth",block:"start"});
}
function resetFeeForm() {
  $("feeForm").reset();
  $("feeEditId").value = "";
  $("feeAmountPaid").value = "0";
  $("feeStatus").value = "pending";
  $("feeFormHeading").textContent = "Add Fee Record";
  $("saveFeeButton").textContent = "Save Fee";
  $("cancelFeeEditButton").classList.add("hidden");
}
async function loadFeeRecords() {
  const button = $("loadFeesButton");
  setBusy(button,true,"Loading…","Refresh Fee Records");
  showStatus("feeRecordsMessage","Loading fee records…");
  try {
    const [{data: fees,error: feeError},{data: students,error: studentError}] = await Promise.all([
      supabase.from("fees").select("id, student_id, description, amount, amount_paid, due_date, status, created_at").order("created_at",{ascending:false}),
      supabase.from("students").select("id, full_name, admission_number, class_name, parent_name, parent_phone").order("full_name")
    ]);
    if (feeError) throw feeError;
    if (studentError) throw studentError;
    feeStudentsCache = students || [];
    feeRecordsCache = fees || [];
    populateFeeClassFilter();
    renderFeeRecords();
  } catch (err) {
    console.error("Could not load fee records:",err);
    showStatus("feeRecordsMessage","Could not load fee records: "+(err.message||String(err)));
  } finally {
    setBusy(button,false,"","Refresh Fee Records");
  }
}
$("feeForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const button=$("saveFeeButton");
  const total=Number($("feeAmount").value);
  const paid=Number($("feeAmountPaid").value);
  if (!Number.isFinite(total) || total<=0 || !Number.isFinite(paid) || paid<0 || paid>total) {
    showStatus("feeMessage","Enter a valid total fee and an amount paid between ₹0 and the total fee.");
    return;
  }
  const record={
    student_id:$("feeStudent").value,
    description:$("feeDescription").value.trim(),
    amount:total,
    amount_paid:paid,
    due_date:$("feeDueDate").value || null,
    status: paid>=total ? "paid" : paid>0 ? "partially_paid" : ($("feeDueDate").value && $("feeDueDate").value<feeToday() ? "overdue" : "pending")
  };
  const editId=$("feeEditId").value;
  setBusy(button,true,editId?"Updating…":"Saving…",editId?"Update Fee":"Save Fee");
  try {
    const result = editId
      ? await supabase.from("fees").update(record).eq("id",editId).select("id").single()
      : await supabase.from("fees").insert(record).select("id").single();
    if (result.error) throw result.error;
    showStatus("feeMessage",editId?"Fee record updated successfully.":"Fee record added successfully.");
    resetFeeForm();
    await loadFeeRecords();
  } catch(err) {
    console.error("Could not save fee record:",err);
    showStatus("feeMessage","Could not save fee record: "+(err.message||String(err))+". Check Supabase table permissions and RLS policies.");
  } finally {
    button.disabled=false;
    button.textContent=$("feeEditId").value?"Update Fee":"Save Fee";
  }
});
$("cancelFeeEditButton")?.addEventListener("click",resetFeeForm);
$("loadFeesButton")?.addEventListener("click",loadFeeRecords);
$("feeSearch")?.addEventListener("input",renderFeeRecords);
$("feeClassFilter")?.addEventListener("change",renderFeeRecords);
$("feeStatusFilter")?.addEventListener("change",renderFeeRecords);

$("logout").addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    message.textContent = error.message;
    return;
  }
  location.href = "admin-login.html";
});

const today = new Date();
const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
  .toISOString().slice(0, 10);
$("attendanceDate").value = localDate;
$("attendanceViewDate").value = localDate;

checkAdmin().catch(err => {
  console.error("Admin dashboard error:", err);
  welcome.textContent = "Could not verify admin access.";
  message.textContent = "Error: " + (err.message || String(err));
});
