
const taskForm = document.getElementById("taskForm");
const taskInput = document.getElementById("taskInput");
const priorityInput = document.getElementById("priority");
const dueDateInput = document.getElementById("dueDate");
const taskList = document.getElementById("taskList");

let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
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
    const completed = tasks.filter(t => t.completed).length;

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
        Notification.permission !== "granted") return;

    tasks.forEach(task => {
        if (!task.dueDate || task.completed || task.reminded) return;

        const remaining = new Date(task.dueDate).getTime() - Date.now();

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

            const latestTask = tasks.find(t => t.id === task.id);

            if (!latestTask || latestTask.completed) return;

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

// Task rendering
function renderTasks() {
    taskList.innerHTML = "";

    const filteredTasks = tasks.filter(task => {
        if (currentFilter === "completed") return task.completed;
        if (currentFilter === "pending") return !task.completed;
        return true;
    });

    if (filteredTasks.length === 0) {
        taskList.innerHTML =
            '<li class="empty">No tasks found. Add a new task!</li>';
    }

    filteredTasks.forEach(task => {
        const li = document.createElement("li");
        li.className = `task ${task.completed ? "completed" : ""}`;
        li.draggable = true;
        li.dataset.id = task.id;

        const handle = document.createElement("span");
        handle.className = "drag-handle";
        handle.textContent = "⠿";
        handle.title = "Drag to reorder";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = task.completed;
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
        priority.className = `priority ${task.priority}`;
        priority.textContent = task.priority + " Priority";

        info.append(name, priority);

        if (task.dueDate) {
            const due = document.createElement("small");
            const date = new Date(task.dueDate);

            due.textContent = "Due: " + date.toLocaleString();

            if (!task.completed && date.getTime() < Date.now()) {
                due.classList.add("overdue");
                due.textContent += " (Overdue)";
            }

            info.appendChild(due);
        }

        const actions = document.createElement("div");
        actions.className = "task-actions";

        const edit = document.createElement("button");
        edit.className = "edit-btn";
        edit.textContent = "Edit";

        edit.addEventListener("click", () => {
            const updated = prompt("Edit task:", task.text);

            if (updated === null || !updated.trim()) return;

            task.text = updated.trim();

            const newPriority = prompt(
                "Priority: Low, Medium or High",
                task.priority
            );

            if (newPriority !== null) {
                const valid = ["Low", "Medium", "High"];
                const value = valid.find(
                    p => p.toLowerCase() === newPriority.trim().toLowerCase()
                );

                if (value) task.priority = value;
            }

            const newDue = prompt(
                "Due date (YYYY-MM-DDTHH:mm), or leave empty:",
                task.dueDate
            );

            if (newDue !== null) {
                const parsed = newDue ? new Date(newDue) : null;

                if (!newDue || !isNaN(parsed.getTime())) {
                    task.dueDate = newDue;
                    task.reminded = false;
                }
            }

            saveTasks();
            renderTasks();
        });

        const remove = document.createElement("button");
        remove.className = "delete-btn";
        remove.textContent = "Delete";

        remove.addEventListener("click", () => {
            tasks = tasks.filter(t => t.id !== task.id);
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

            if (draggedId === null || draggedId === task.id) return;

            const from = tasks.findIndex(t => t.id === draggedId);
            const to = tasks.findIndex(t => t.id === task.id);

            if (from < 0 || to < 0) return;

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

    if (!text) return;

    const dueDate = dueDateInput.value;

    if (dueDate && isNaN(new Date(dueDate).getTime())) {
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

        document.querySelectorAll(".filter").forEach(btn => {
            btn.classList.remove("active");
        });

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
