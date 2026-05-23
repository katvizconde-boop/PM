// Derive a 2-4 char project prefix from its name. Used to build display task IDs
// like "QOS-12" so people can refer to tasks unambiguously in chat.
//
//   "Demo Project"          -> "DP"
//   "Q3 Onboarding Sprint"  -> "QOS"
//   "Internal Delivery"     -> "ID"
//   "Onboarding"            -> "ONB"
//   ""                      -> "PRJ"
export function projectPrefix(name) {
  if (!name?.trim()) return 'PRJ';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase();
  }
  return words.map(w => w[0]).join('').slice(0, 4).toUpperCase();
}

export function taskCode(projectName, taskId) {
  return `${projectPrefix(projectName)}-${taskId}`;
}
