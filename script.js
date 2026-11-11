
const taskForm = document.getElementById("taskForm");
const taskInput = document.getElementById("taskInput");
const priorityInput = document.getElementById("priority");
const dueDateInput = document.getElementById("dueDate");
const taskList = document.getElementById("taskList");

// Edit modal elements
const editModal = document.getElementById("editModal");
const editForm = document.getElementById("editForm");
const editTitle = document.getElementById("editTitle");
const editPriority = document.getElementById("editPriority");
const editDueDate = document.getElementById("editDueDate");
const cancelEdit = document.getElementById("cancelEdit");

let activeTaskId = null;

// Safely load tasks from Local Storage
function loadTasks() {
    try {
        const savedTasks = localStorage.getItem("tasks");

        if (!savedTasks) {
            return [];
        }

        const parsedTasks = JSON.parse(savedTasks);

        if (!Array.isArray(parsedTasks)) {
            return [];
        }

        return parsedTasks.filter(task =>
            task &&
            typeof task === "object" &&
            typeof task.text === "string"
        );
    } catch (error) {
        console.error("Error loading tasks:", error);
        return [];
    }
}

let tasks = loadTasks();
let currentFilter = "all";
let draggedId = null;
let reminderTimers = new Map();

const MAX_TIMEOUT = 2147483647;

// Save tasks
function saveTasks() {
    localStorage.setItem("tasks", JSON.stringify(tasks));
}

// Dark mode
const themeToggle = document.getElementById("themeToggle");

function applyTheme(dark) {
    document.body.classList.toggle("dark", dark);
    themeToggle.textContent = dark ? "☀️ Light Mode" : "🌙 Dark Mode";
    localStorage.setItem("darkMode", dark);
}

applyTheme(localStorage.getItem("darkMode") === "true");

themeToggle.addEventListener("click", () => {
    applyTheme(!document.body.classList.contains("dark"));
});

// Statistics
function updateStats() {
    const completed = tasks.filter(task => task.completed).length;

    document.getElementById("totalTasks").textContent = tasks.length;
    document.getElementById("completedTasks").textContent = completed;
    document.getElementById("pendingTasks").textContent =
        tasks.length - completed;
}

// Notifications
function enableReminders() {
    if (!("Notification" in window)) {
        alert("Your browser does not support notifications.");
        return;
    }

    Notification.requestPermission().then(permission => {
        if (permission === "granted") {
            document.getElementById("reminderToggle").textContent =
                "🔔 Reminders Enabled";

            scheduleReminders();
            alert("Reminders enabled successfully!");
        } else {
            alert("Please allow notifications in your browser settings.");
        }
    });
}

document.getElementById("reminderToggle")
    .addEventListener("click", enableReminders);

function scheduleReminders() {
    reminderTimers.forEach(timer => clearTimeout(timer));
    reminderTimers.clear();

    if (!("Notification" in window) ||
        Notification.permission !== "granted") {
        return;
    }

    tasks.forEach(task => {
        if (!task.dueDate || task.completed || task.reminded) {
            return;
        }

        const remaining =
            new Date(task.dueDate).getTime() - Date.now();

        if (remaining <= 0) {
            task.reminded = true;
            saveTasks();

            new Notification("Task deadline reached!", {
                body: task.text
            });

            return;
        }

        const delay = Math.min(remaining, MAX_TIMEOUT);

        const timer = setTimeout(() => {
            if (remaining > MAX_TIMEOUT) {
                scheduleReminders();
                return;
            }

            const latestTask = tasks.find(
                item => item.id === task.id
            );

            if (!latestTask || latestTask.completed) {
                return;
            }

            latestTask.reminded = true;
            saveTasks();

            new Notification("Task reminder 🔔", {
                body: latestTask.text
            });

            renderTasks();
        }, delay);

        reminderTimers.set(task.id, timer);
    });
}

// Find the current Edit button for a task
function findEditButton(taskId) {
    return Array.from(
        taskList.querySelectorAll(".edit-btn")
    ).find(button =>
        button.dataset.taskId === String(taskId)
    );
}

// Close modal and restore keyboard focus
function closeEditModal() {
    editModal.classList.add("hidden");

    if (activeTaskId !== null) {
        const buttonToFocus = findEditButton(activeTaskId);

        if (buttonToFocus) {
            buttonToFocus.focus();
        }
    }

    activeTaskId = null;
}

// Save changes from the edit form
editForm.addEventListener("submit", event => {
    event.preventDefault();

    const task = tasks.find(
        item => String(item.id) === activeTaskId
    );

    if (!task) {
        closeEditModal();
        return;
    }

    const updatedTitle = editTitle.value.trim();
    const updatedDueDate = editDueDate.value;

    if (!updatedTitle) {
        editTitle.focus();
        return;
    }

    if (updatedDueDate &&
        isNaN(new Date(updatedDueDate).getTime())) {
        alert("Please enter a valid due date.");
        editDueDate.focus();
        return;
    }

    task.text = updatedTitle;
    task.priority = editPriority.value;
    task.dueDate = updatedDueDate;
    task.reminded = false;

    saveTasks();
    renderTasks();
    closeEditModal();
});

// Cancel button
cancelEdit.addEventListener("click", closeEditModal);

// Close modal when clicking outside
editModal.addEventListener("click", event => {
    if (event.target === editModal) {
        closeEditModal();
    }
});

// Close modal with Escape key
document.addEventListener("keydown", event => {
    if (
        event.key === "Escape" &&
        !editModal.classList.contains("hidden")
    ) {
        event.preventDefault();
        closeEditModal();
    }
});

// Keyboard focus trapping
editModal.addEventListener("keydown", event => {
    if (event.key !== "Tab") {
        return;
    }

    const focusableElements = editModal.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
    );

    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];

    if (!first || !last) {
        return;
    }

    if (event.shiftKey &&
        document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (
        !event.shiftKey &&
        document.activeElement === last
    ) {
        event.preventDefault();
        first.focus();
    }
});

// Task rendering
function renderTasks() {
    taskList.innerHTML = "";

    const filteredTasks = tasks.filter(task => {
        if (currentFilter === "completed") {
            return task.completed;
        }

        if (currentFilter === "pending") {
            return !task.completed;
        }

        return true;
    });

    if (filteredTasks.length === 0) {
        taskList.innerHTML =
            '<li class="empty">No tasks found. Add a new task!</li>';
    }

    filteredTasks.forEach(task => {
        const li = document.createElement("li");
        li.className =
            `task ${task.completed ? "completed" : ""}`;
        li.draggable = true;
        li.dataset.id = task.id;

        const handle = document.createElement("span");
        handle.className = "drag-handle";
        handle.textContent = "⠿";
        handle.title = "Drag to reorder";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = Boolean(task.completed);
        checkbox.setAttribute("aria-label", "Complete task");

        checkbox.addEventListener("change", () => {
            task.completed = checkbox.checked;
            saveTasks();
            renderTasks();
        });

        const info = document.createElement("div");
        info.className = "task-info";

        const name = document.createElement("div");
        name.className = "task-name";
        name.textContent = task.text;

        const priority = document.createElement("span");
        priority.className =
            `priority ${task.priority || "Medium"}`;
        priority.textContent =
            `${task.priority || "Medium"} Priority`;

        info.append(name, priority);

        if (task.dueDate) {
            const due = document.createElement("small");
            const date = new Date(task.dueDate);

            due.textContent = "Due: " + date.toLocaleString();

            if (!task.completed &&
                date.getTime() < Date.now()) {
                due.classList.add("overdue");
                due.textContent += " (Overdue)";
            }

            info.appendChild(due);
        }

        const actions = document.createElement("div");
        actions.className = "task-actions";

        // Edit button
        const edit = document.createElement("button");
        edit.className = "edit-btn";
        edit.textContent = "Edit";
        edit.type = "button";
        edit.dataset.taskId = String(task.id);
        edit.setAttribute(
            "aria-label",
            `Edit task: ${task.text}`
        );

        edit.addEventListener("click", () => {
            activeTaskId = String(task.id);

            editTitle.value = task.text;
            editPriority.value = task.priority || "Medium";
            editDueDate.value = task.dueDate || "";

            editModal.classList.remove("hidden");
            editTitle.focus();
        });

        // Delete button
        const remove = document.createElement("button");
        remove.className = "delete-btn";
        remove.textContent = "Delete";
        remove.type = "button";
        remove.setAttribute(
            "aria-label",
            `Delete task: ${task.text}`
        );

        remove.addEventListener("click", () => {
            tasks = tasks.filter(
                item => item.id !== task.id
            );

            saveTasks();
            renderTasks();
        });

        actions.append(edit, remove);
        li.append(handle, checkbox, info, actions);

        // Drag and drop
        li.addEventListener("dragstart", () => {
            draggedId = task.id;
            li.classList.add("dragging");
        });

        li.addEventListener("dragend", () => {
            draggedId = null;
            li.classList.remove("dragging");
        });

        li.addEventListener("dragover", event => {
            event.preventDefault();
        });

        li.addEventListener("drop", event => {
            event.preventDefault();

            if (draggedId === null ||
                draggedId === task.id) {
                return;
            }

            const from = tasks.findIndex(
                item => item.id === draggedId
            );

            const to = tasks.findIndex(
                item => item.id === task.id
            );

            if (from < 0 || to < 0) {
                return;
            }

            const [moved] = tasks.splice(from, 1);
            tasks.splice(to, 0, moved);

            saveTasks();
            renderTasks();
        });

        taskList.appendChild(li);
    });

    updateStats();
    scheduleReminders();
}

// Add tasks
taskForm.addEventListener("submit", event => {
    event.preventDefault();

    const text = taskInput.value.trim();

    if (!text) {
        return;
    }

    const dueDate = dueDateInput.value;

    if (dueDate &&
        isNaN(new Date(dueDate).getTime())) {
        alert("Please enter a valid deadline.");
        return;
    }

    tasks.push({
        id: Date.now() + Math.random(),
        text,
        priority: priorityInput.value,
        dueDate,
        completed: false,
        reminded: false
    });

    saveTasks();
    renderTasks();

    taskForm.reset();
    taskInput.focus();
});

// Filters
document.querySelectorAll(".filter").forEach(button => {
    button.addEventListener("click", () => {
        currentFilter = button.dataset.filter;

        document.querySelectorAll(".filter").forEach(
            filterButton => {
                filterButton.classList.remove("active");
            }
        );

        button.classList.add("active");
        renderTasks();
    });
});

// Refresh reminder schedule when page becomes active
document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
        scheduleReminders();
    }
});

// Initial load
renderTasks();
