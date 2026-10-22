
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

  select.replaceChildren(
    new Option(error ? "Could not load subjects" : "Select a subject", "")
  );

  if (error) {
    console.error("Subject loading failed:", error.message);
    return;
  }

  (data || []).forEach(subject =>
    select.add(new Option(subject.name, subject.name))
  );
}

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
    message.textContent =
      "Admin access verified, but some data could not load: " + err.message;
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

  const feature = dashboard.querySelector(
    '[data-feature="' + page + '"]'
  );

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

  history.replaceState(
    null,
    "",
    "admin-dashboard.html?page=" + encodeURIComponent(page)
  );

  if (page === "attendance") loadAttendanceRecords();
}

function showHome() {
  dashboard.querySelectorAll("[data-feature]").forEach(card => {
    card.classList.remove("hidden");
  });

  dashboard.classList.add("hidden");
  launcher.classList.remove("hidden");
  backButton.classList.add("hidden");
  history.replaceState(null, "", "admin-dashboard.html");
}

launcher.querySelectorAll("[data-page]").forEach(button => {
  button.addEventListener("click", () => openPage(button.dataset.page));
});

backButton.addEventListener("click", showHome);

$("openSubjects").addEventListener("click", () => {
  location.href = "manage-subjects.html";
});

$("openGallery").addEventListener("click", () => {
  location.href = "manage-gallery.html";
});

async function invokeUserCreation(body) {
  const { data: { session }, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError) throw sessionError;

  if (!session?.access_token) {
    throw new Error("Your session expired. Please sign in again.");
  }

  const { data, error } = await supabase.functions.invoke(
    "manage-school-users",
    {
      body,
      headers: {
        Authorization: "Bearer " + session.access_token
      }
    }
  );

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

  for (const id of [
    "attendanceStudent",
    "marksStudent",
    "resultsStudent"
  ]) {
    const select = $(id);
    select.replaceChildren();

    const option = document.createElement("option");
    option.value = "";
    option.textContent =
      id === "resultsStudent"
        ? "All students"
        : students.length
          ? "Select a student"
          : "No students found";

    select.appendChild(option);

    students.forEach(student => {
      const opt = document.createElement("option");
      opt.value = student.id;
      opt.textContent =
        `${student.full_name} (${student.admission_number || "No admission number"})` +
        `${student.class_name ? " - " + student.class_name : ""}`;

      select.appendChild(opt);
    });
  }
}

$("studentForm").addEventListener("submit", async e => {
  e.preventDefault();
  showStatus("studentMessage", "");

  if (!adminUser) {
    return showStatus(
      "studentMessage",
      "Admin access has not been verified."
    );
  }

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

    if (body.password.length < 12) {
      throw new Error("Password must be at least 12 characters.");
    }

    await invokeUserCreation(body);

    showStatus(
      "studentMessage",
      "Student account and profile created successfully."
    );

    $("studentForm").reset();
    await loadStudents();
  } catch (err) {
    showStatus(
      "studentMessage",
      "Could not create student: " +
        (err.message || "Unknown error")
    );
  } finally {
    setBusy(button, false, "", "Create Student");
  }
});

$("createAdminForm").addEventListener("submit", async e => {
  e.preventDefault();
  showStatus("createAdminMessage", "");

  if (!adminUser) {
    return showStatus(
      "createAdminMessage",
      "Please sign in with an existing admin account."
    );
  }

  const button = $("createAdminButton");
  setBusy(button, true, "Creating admin...", "Create Admin Account");

  try {
    const fullName = $("newAdminName").value.trim();
    const email = $("newAdminEmail").value.trim();
    const password = $("newAdminPassword").value;

    if (!fullName || !email || password.length < 12) {
      throw new Error(
        "Enter a name, valid email, and password of at least 12 characters."
      );
    }

    await invokeUserCreation({
      email,
      password,
      role: "admin",
      full_name: fullName
    });

    showStatus(
      "createAdminMessage",
      "Admin account created successfully with the admin role."
    );

    $("createAdminForm").reset();
  } catch (err) {
    showStatus(
      "createAdminMessage",
      "Could not create admin: " +
        (err.message || "Unknown error")
    );
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

  if (!studentId) {
    return showStatus("marksMessage", "Please select a student.");
  }

  if (
    !examName ||
    !subject ||
    !Number.isFinite(marksObtained) ||
    !Number.isFinite(maxMarks) ||
    marksObtained < 0 ||
    maxMarks <= 0 ||
    marksObtained > maxMarks
  ) {
    return showStatus(
      "marksMessage",
      "Enter valid marks. Obtained marks cannot exceed maximum marks."
    );
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
    showStatus(
      "marksMessage",
      "Could not save marks: " + err.message
    );
  } finally {
    setBusy(button, false, "", "Save Marks");
  }
});

$("viewStudentResults").addEventListener("click", async () => {
  const studentId = $("resultsStudent").value;

  showStatus("resultsMessage", "Loading results...");
  $("resultsList").replaceChildren();

  try {
    let query = supabase
      .from("marks")
      .select(
        "exam_name, subject, marks_obtained, max_marks, student_id, students(full_name, admission_number, class_name)"
      )
      .order("exam_name");

    if (studentId) {
      query = query.eq("student_id", studentId);
    }

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
      `${(
        (Number(r.marks_obtained) / Number(r.max_marks)) * 100
      ).toFixed(1)}%`
    ]);

    $("resultsList").appendChild(
      makeTable(
        [
          "Student",
          "Admission No.",
          "Class",
          "Exam",
          "Subject",
          "Marks",
          "Percentage"
        ],
        rows
      )
    );

    showStatus(
      "resultsMessage",
      `${data.length} result(s) found.`
    );
  } catch (err) {
    showStatus(
      "resultsMessage",
      "Could not load results: " + err.message
    );
  }
});

$("attendanceForm").addEventListener("submit", async e => {
  e.preventDefault();
  showStatus("attendanceMessage", "");

  const student_id = $("attendanceStudent").value;
  const attendance_date = $("attendanceDate").value;
  const status = $("attendanceStatus").value;

  if (!student_id || !attendance_date) {
    return showStatus(
      "attendanceMessage",
      "Please select a student and date."
    );
  }

  const button = $("saveAttendanceButton");
  setBusy(button, true, "Saving...", "Save Attendance");

  try {
    const { error } = await supabase.from("attendance").upsert(
      { student_id, attendance_date, status },
      { onConflict: "student_id,attendance_date" }
    );

    if (error) throw error;

    showStatus(
      "attendanceMessage",
      "Attendance saved successfully."
    );

    await loadAttendanceRecords();
  } catch (err) {
    showStatus(
      "attendanceMessage",
      "Could not save attendance: " + err.message
    );
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
      .select(
        "attendance_date,status,students(full_name,admission_number,class_name)"
      )
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
      const studentClass =
        record.students?.class_name || "Unknown class";

      if (!classes[studentClass]) {
        classes[studentClass] = [];
      }

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
        makeTable(
          ["Student", "Admission No.", "Status"],
          classes[studentClass]
        )
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

$("viewAttendanceButton").addEventListener(
  "click",
  loadAttendanceRecords
);

async function loadClassAttendance() {
  const className = $("attendanceClass").value;
  const date = $("classAttendanceDate").value;
  const list = $("classAttendanceList");

  showStatus("classAttendanceMessage", "");
  list.replaceChildren();

  if (!className || !date) {
    showStatus(
      "classAttendanceMessage",
      "Please select a class and date."
    );
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
      showStatus(
        "classAttendanceMessage",
        "No students found in this class."
      );
      return;
    }

    const { data: saved, error: savedError } = await supabase
      .from("attendance")
      .select("student_id, status")
      .eq("attendance_date", date)
      .in("student_id", students.map(s => s.id));

    if (savedError) throw savedError;

    const savedByStudent = new Map(
      (saved || []).map(record => [
        record.student_id,
        record.status
      ])
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
      admissionCell.textContent =
        student.admission_number || "—";

      const buttons = document.createElement("div");
      buttons.className = "attendance-buttons";

      const currentStatus =
        savedByStudent.get(student.id) || "";

      ["Present", "Absent"].forEach(status => {
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
          buttons.querySelectorAll("button").forEach(btn => {
            btn.classList.remove("selected");
          });

          button.classList.add("selected");
        });

        buttons.appendChild(button);
      });

      statusCell.appendChild(buttons);

      row.appendChild(nameCell);
      row.appendChild(admissionCell);
      row.appendChild(statusCell);
      tbody.appendChild(row);
    });

    list.appendChild(table);

    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.id = "saveClassAttendanceButton";
    saveButton.textContent = "Save Class Attendance";

    saveButton.addEventListener("click", async () => {
      const records = [];

      tbody.querySelectorAll("tr").forEach(row => {
        const selected = row.querySelector(
          ".attendance-choice.selected"
        );

        if (selected) {
          records.push({
            student_id: selected.dataset.studentId,
            attendance_date: date,
            status: selected.dataset.status
          });
        }
      });

      if (!records.length) {
        showStatus(
          "classAttendanceMessage",
          "Select Present or Absent for at least one student."
        );
        return;
      }

      setBusy(
        saveButton,
        true,
        "Saving attendance...",
        "Save Class Attendance"
      );

      try {
        const { error } = await supabase
          .from("attendance")
          .upsert(records, {
            onConflict: "student_id,attendance_date"
          });

        if (error) throw error;

        showStatus(
          "classAttendanceMessage",
          "Class attendance saved successfully."
        );

        await loadAttendanceRecords();
      } catch (err) {
        showStatus(
          "classAttendanceMessage",
          "Could not save class attendance: " + err.message
        );
      } finally {
        setBusy(
          saveButton,
          false,
          "",
          "Save Class Attendance"
        );
      }
    });

    list.appendChild(saveButton);

    showStatus(
      "classAttendanceMessage",
      `${students.length} student(s) loaded. Select attendance and save.`
    );
  } catch (err) {
    showStatus(
      "classAttendanceMessage",
      "Could not load class attendance: " + err.message
    );
  }
}

$("loadClassAttendanceButton").addEventListener(
  "click",
  loadClassAttendance
);

$("loadEnquiries").addEventListener("click", async () => {
  const button = $("loadEnquiries");

  setBusy(button, true, "Loading...", "Load Enquiries");
  showStatus("enquiryStatus", "Loading enquiries...");
  $("enquiriesList").replaceChildren();

  try {
    const { data, error } = await supabase
      .from("school_enquiries")
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

      card.style.cssText =
        "border:1px solid #cbd5e1;border-radius:10px;padding:14px;margin:12px 0";

      const title = document.createElement("h4");
      title.textContent = enquiry.name || "Unnamed visitor";
      card.appendChild(title);

      [
        ["Email", enquiry.email],
        ["Phone", enquiry.phone],
        ["Enquiry type", enquiry.subject],
        ["Message", enquiry.message],
        [
          "Submitted",
          enquiry.created_at
            ? new Date(enquiry.created_at).toLocaleString()
            : "Not available"
        ]
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
        a.href =
          "https://wa.me/" +
          wa +
          "?text=" +
          encodeURIComponent(
            `Hello ${enquiry.name || "Parent"}, thank you for contacting Jnyanabindu Public School, Dambal. We received your enquiry about ${enquiry.subject || "your request"}. How can we help you?`
          );

        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = "💬 Contact on WhatsApp";

        card.appendChild(a);
      }

      $("enquiriesList").appendChild(card);
    });

    showStatus(
      "enquiryStatus",
      `${data.length} enquiry(s) loaded.`
    );
  } catch (err) {
    showStatus(
      "enquiryStatus",
      "Could not load enquiries: " + err.message
    );
  } finally {
    setBusy(button, false, "", "Load Enquiries");
  }
});

$("loadKindergartenEnquiries").addEventListener(
  "click",
  async () => {
    const button = $("loadKindergartenEnquiries");
    const status = $("kgEnquiryStatus");
    const list = $("kgEnquiriesList");

    setBusy(
      button,
      true,
      "Loading...",
      "Load Admission Enquiries"
    );

    status.textContent = "Loading admission enquiries...";
    list.replaceChildren();

    try {
      const { data, error } = await supabase
        .from("kindergarten_enquiries")
        .select(
          "parent_name, phone, child_name, date_of_birth, applying_for, previous_school, message, created_at"
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!data?.length) {
        list.textContent =
          "No kindergarten admission enquiries found.";

        status.textContent = "0 enquiries found.";
        return;
      }

      data.forEach(item => {
        const card = document.createElement("article");

        card.style.cssText =
          "border:1px solid #cbd5e1;border-radius:10px;padding:14px;margin:12px 0;overflow-wrap:anywhere";

        const heading = document.createElement("h4");
        heading.textContent =
          item.child_name || "Child name not provided";

        card.appendChild(heading);

        [
          ["Parent / Guardian", item.parent_name],
          ["Phone", item.phone],
          ["Class", item.applying_for],
          ["Date of birth", item.date_of_birth],
          ["Previous school", item.previous_school],
          ["Message", item.message],
          [
            "Submitted",
            item.created_at
              ? new Date(item.created_at).toLocaleString()
              : "Not available"
          ]
        ].forEach(([label, value]) => {
          const p = document.createElement("p");

          p.textContent =
            label + ": " + (value || "Not provided");

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

      status.textContent =
        data.length + " admission enquiry(s) loaded.";
    } catch (err) {
      console.error(
        "Could not load kindergarten enquiries:",
        err
      );

      status.textContent =
        "Could not load enquiries: " + err.message;
    } finally {
      setBusy(
        button,
        false,
        "",
        "Load Admission Enquiries"
      );
    }
  }
);

$("logout").addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    message.textContent = error.message;
    return;
  }

  location.href = "admin-login.html";
});

const today = new Date();

const localDate = new Date(
  today.getTime() - today.getTimezoneOffset() * 60000
)
  .toISOString()
  .slice(0, 10);

$("attendanceDate").value = localDate;
$("attendanceViewDate").value = localDate;

checkAdmin().catch(err => {
  console.error("Admin dashboard error:", err);

  welcome.textContent = "Could not verify admin access.";

  message.textContent =
    "Error: " + (err.message || String(err));
});
