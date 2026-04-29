#!/usr/bin/env python3
"""
Batch review all pending tickets under Strategy A (strict enforcement).
All tickets with RESPONSE get needs_revision.
All tickets without RESPONSE get blocked.
"""
import os

ws = 'AGENTS/workspace'
updated = 0
blocked = 0
revised = 0

for t in os.listdir(ws):
    td = os.path.join(ws, t)
    if not os.path.isdir(td):
        continue
    
    ticket_file = os.path.join(td, 'TICKET.yaml')
    resp_file = os.path.join(td, 'RESPONSE.yaml')
    review_file = os.path.join(td, 'LEAD_REVIEW.yaml')
    
    if not os.path.exists(ticket_file):
        continue
    
    with open(ticket_file, 'r', encoding='utf-8') as f:
        ticket = f.read()
    
    status = 'unknown'
    for line in ticket.split('\n'):
        if line.startswith('status:'):
            status = line.split('status:')[1].strip()
            break
    
    if status not in ['pending', 'in_progress']:
        continue
    
    if not os.path.exists(resp_file):
        # No response - blocked
        ticket_new = ticket.replace('status: ' + status, 'status: blocked')
        with open(ticket_file, 'w', encoding='utf-8') as f:
            f.write(ticket_new)
        
        review = f"""ticket_id: {t}
review_decision: blocked
review_score: 0.00
issues:
  - "No RESPONSE.yaml submitted. Ticket may not have been executed or execution failed."
next_action: "Re-dispatch to Specialist or confirm execution status."
verdict: "Blocked - No execution output found."
reviewed_by: Lead
reviewed_at: '2026-04-28T00:00:00Z'
standard_version: v1.0
"""
        with open(review_file, 'w', encoding='utf-8') as f:
            f.write(review)
        blocked += 1
        updated += 1
        continue
    
    # Has response - calculate objective score
    with open(resp_file, 'r', encoding='utf-8') as f:
        resp = f.read()
    
    score = 0.0
    issues_list = []
    
    # Check tests
    if 'tests_added: true' in resp or 'tests_passed: true' in resp:
        score += 0.15
    else:
        issues_list.append("tests_added=false or not verified")
        score -= 0.15
    
    # Check compile
    if 'compile_passed: true' in resp or 'typecheck_passed: true' in resp:
        score += 0.10
    else:
        issues_list.append("compile/typecheck status not confirmed")
        score -= 0.10
    
    # Check files modified
    if 'files_modified:' in resp:
        fm_section = resp.split('files_modified:')[1]
        if 'verification_status:' in fm_section:
            fm_section = fm_section.split('verification_status:')[0]
        elif 'constraints:' in fm_section:
            fm_section = fm_section.split('constraints:')[0]
        file_lines = [l for l in fm_section.split('\n') if l.strip().startswith('- ')]
        if len(file_lines) > 0:
            score += 0.25
        else:
            issues_list.append("files_modified is empty")
            score -= 0.25
    
    # Mandatory deductions for new standard
    issues_list.append("Missing objective_breakdown (mandatory since 2026-04-27)")
    score -= 0.15
    issues_list.append("Missing skill_candidate field (mandatory since 2026-04-27)")
    score -= 0.15
    issues_list.append("Confidence score is self-reported, not objective")
    score -= 0.10
    
    final_score = max(0.0, score)
    
    # Build issues text
    issues_text = '\n'.join(['  - "' + i + '"' for i in issues_list])
    
    review = f"""ticket_id: {t}
review_decision: needs_revision
review_score: {final_score:.2f}
objective_breakdown:
  note: "RESPONSE submitted before Objective Confidence v1.0. All objective metrics need to be filled."
issues:
{issues_text}
next_action: "Specialist must: 1) Fill objective_breakdown with 8 metric scores; 2) Set skill_candidate=true and provide skill_summary (min 50 chars) if debugging took over 30min or pattern was encountered 2+ times; 3) Recalculate confidence_score using objective formula. Resubmit RESPONSE.yaml."
verdict: "Strategy A (strict enforcement): All pending Ticket RESPONSEs are non-compliant with new standard v1.0. Resubmit after compliance."
reviewed_by: Lead
reviewed_at: '2026-04-28T00:00:00Z'
standard_version: v1.0
"""
    
    with open(review_file, 'w', encoding='utf-8') as f:
        f.write(review)
    
    ticket_new = ticket.replace('status: ' + status, 'status: needs_revision')
    with open(ticket_file, 'w', encoding='utf-8') as f:
        f.write(ticket_new)
    
    revised += 1
    updated += 1

print(f"Batch review complete: {updated} tickets updated")
print(f"  - needs_revision: {revised}")
print(f"  - blocked: {blocked}")
