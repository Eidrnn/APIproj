1. Is the student's ID always the same value everywhere?
The endpoint list says Team 7 needs to "match the student's CampusCore identity with their FitCoach account" (GET /fitcoach-users/{fitcoach_userId}/profile → "create a linkage" via POST .../fitcoach-bindings). But the contract uses three different names for what might be the same ID: fitcoach_userId in the URL, student_id in the profile response, and campuscore_student_id in the binding request. Is it one ID with different labels, or two separate IDs we need to track?

2. What do we get back if something goes wrong?
For "read a student's profile" and "create a linkage," the contract only shows what happens when it works. What does the API send back if the student ID doesn't exist, or if linking the accounts fails?

3. What does "pending" or "suspended" mean for a linked account?
When a linkage is created, the response can say status: active, pending, or suspended. The endpoint list just says we need to "create a linkage" — it doesn't say what a pending or suspended account should look like on the FitCoach side. Should the user be blocked from anything while it's not active?
