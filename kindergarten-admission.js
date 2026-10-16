
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
    "https://tjybrmumnxulnqxpsxhi.supabase.co",
    "sb_publishable_1APbA6E1TJaD0iWNIxojwQ_7fPG3LT7"
);

const form = document.getElementById("kindergartenAdmissionForm");

if (form) {
    const status = document.getElementById("kgAdmissionMessage");
    const button = form.querySelector('button[type="submit"]');
    const dob = document.getElementById("kgDob");

    if (dob) {
        const today = new Date();
        const localToday = [
            today.getFullYear(),
            String(today.getMonth() + 1).padStart(2, "0"),
            String(today.getDate()).padStart(2, "0")
        ].join("-");
        dob.max = localToday;
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const parentName = document.getElementById("kgParentName").value.trim();
        const phone = document.getElementById("kgPhone").value.trim();
        const childName = document.getElementById("kgChildName").value.trim();
        const dateOfBirth = dob.value;
        const applyingFor = document.getElementById("kgClass").value;
        const previousSchool = document.getElementById("kgPreviousSchool").value.trim();
        const message = document.getElementById("kgMessage").value.trim();

        if (!parentName || !phone || !childName || !dateOfBirth || !applyingFor) {
            status.textContent = "Please complete all required fields.";
            status.style.color = "#b42318";
            return;
        }

        if (!/^[0-9+()\-\s]{7,20}$/.test(phone)) {
            status.textContent = "Please enter a valid contact number.";
            status.style.color = "#b42318";
            return;
        }

        if (dateOfBirth > dob.max) {
            status.textContent = "Date of birth cannot be in the future.";
            status.style.color = "#b42318";
            return;
        }

        button.disabled = true;
        button.textContent = "Submitting...";
        status.textContent = "";

        try {
            const { error } = await supabase
                .from("kindergarten_enquiries")
                .insert({
                    parent_name: parentName,
                    phone,
                    child_name: childName,
                    date_of_birth: dateOfBirth,
                    applying_for: applyingFor,
                    previous_school: previousSchool || null,
                    message: message || null
                });

            if (error) throw error;

            status.textContent =
                "Thank you! Your admission enquiry was submitted successfully.";
            status.style.color = "#18794e";
            form.reset();
        } catch (error) {
            console.error("Kindergarten enquiry submission failed:", error);
            status.textContent =
                "Submission failed: " + error.message;
            status.style.color = "#b42318";
        } finally {
            button.disabled = false;
            button.textContent = "Submit Admission Enquiry →";
        }
    });
}
