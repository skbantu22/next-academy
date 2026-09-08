// A bare <input> nested inside a <form> submits that form on Enter by
// default (native browser behavior). Attach this to onKeyDown on any input
// that must NOT trigger a parent form submit, close a parent modal, or
// navigate the page — e.g. a search box inside the Add/Edit Training form's
// Enrollment section. It only intercepts the Enter key; every other key
// passes through untouched, so it never affects typing, other shortcuts, or
// any other input in the app.
export function stopEnterSubmit(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    event.stopPropagation();
  }
}
