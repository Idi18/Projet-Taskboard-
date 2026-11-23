// Front TaskBoard, appelle /api/tasks
// textContent et pas innerHTML pour eviter le XSS

const list = document.getElementById("tasks");
const empty = document.getElementById("empty");
const form = document.getElementById("new-task");
const input = document.getElementById("titre");
const message = document.getElementById("message");
const counter = document.getElementById("counter");

function showMessage(text, isError = false) {
  message.textContent = text;
  message.className = isError ? "error" : "";
}

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Erreur ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

function formatDate(iso) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function renderTask(task) {
  const li = document.createElement("li");
  if (task.terminee) li.classList.add("done");

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = task.terminee;
  checkbox.title = task.terminee ? "Marquer comme à faire" : "Marquer comme terminée";
  checkbox.addEventListener("change", () => toggleTask(task.id, checkbox.checked));

  const title = document.createElement("span");
  title.className = "titre";
  title.textContent = task.titre;

  const date = document.createElement("time");
  date.dateTime = task.date_creation;
  date.textContent = formatDate(task.date_creation);

  const del = document.createElement("button");
  del.className = "delete";
  del.textContent = "Supprimer";
  del.addEventListener("click", () => deleteTask(task.id));

  li.append(checkbox, title, date, del);
  return li;
}

async function loadTasks() {
  try {
    const tasks = await api("GET", "/api/tasks");
    list.replaceChildren(...tasks.map(renderTask));
    empty.hidden = tasks.length > 0;
    const restantes = tasks.filter((t) => !t.terminee).length;
    counter.textContent = `${restantes} tâche${restantes > 1 ? "s" : ""} restante${restantes > 1 ? "s" : ""} sur ${tasks.length}`;
  } catch (err) {
    showMessage(`Impossible de charger les tâches : ${err.message}`, true);
  }
}

async function toggleTask(id, terminee) {
  try {
    await api("PATCH", `/api/tasks/${id}`, { terminee });
    showMessage("");
  } catch (err) {
    showMessage(err.message, true);
  }
  loadTasks();
}

async function deleteTask(id) {
  try {
    await api("DELETE", `/api/tasks/${id}`);
    showMessage("Tâche supprimée.");
  } catch (err) {
    showMessage(err.message, true);
  }
  loadTasks();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const titre = input.value.trim();
  if (!titre) return;
  try {
    await api("POST", "/api/tasks", { titre });
    input.value = "";
    showMessage("Tâche ajoutée.");
  } catch (err) {
    showMessage(err.message, true);
  }
  loadTasks();
});

loadTasks();
