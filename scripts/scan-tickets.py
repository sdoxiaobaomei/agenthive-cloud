import yaml, os

workspace = "AGENTS/workspace"
platform_tickets = []

for d in sorted(os.listdir(workspace)):
    ticket_path = os.path.join(workspace, d, "TICKET.yaml")
    if os.path.exists(ticket_path):
        try:
            with open(ticket_path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
        except Exception as e:
            print("SKIP " + d + " (yaml error: " + str(e).split(":")[-1].strip() + ")")
            continue
        if not data:
            continue
        if data.get("assigned_team") == "platform":
            resp_path = os.path.join(workspace, d, "RESPONSE.yaml")
            resp_status = None
            if os.path.exists(resp_path):
                try:
                    with open(resp_path, "r", encoding="utf-8") as f:
                        resp = yaml.safe_load(f)
                    resp_status = resp.get("status") if resp else None
                except Exception:
                    pass
            platform_tickets.append({
                "id": data.get("ticket_id"),
                "title": data.get("title"),
                "status": data.get("status"),
                "priority": data.get("priority"),
                "depends": data.get("depends_on", []),
                "resp": resp_status
            })

print("=" * 90)
print("TICKET ID          | PRIO | TICKET STATUS | RESPONSE STATUS | TITLE")
print("=" * 90)
for t in platform_tickets:
    dep = ", ".join(t["depends"]) if t["depends"] else "none"
    line = "{:<18} | {:<4} | {:<13} | {:<15} | {}".format(
        t["id"], str(t["priority"]), str(t["status"]), str(t["resp"] or "none"), str(t["title"])
    )
    print(line)
    if t["depends"]:
        print("  depends_on: " + dep)
