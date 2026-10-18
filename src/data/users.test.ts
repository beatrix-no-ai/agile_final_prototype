import { describe, expect, test } from "vitest";
import { navFor } from "./nav";
import { STAFF, createSchoolUser, principalOf, saveSchoolUser, updateSchoolUser, usersOfSchool, validateUser } from "./users";

describe("school users", () => {
  test("a school has one Principal and several admins", () => {
    const users = usersOfSchool("S001");
    expect(users[0].title).toBe("Principal");
    expect(users.length).toBeGreaterThan(1);
    expect(users.filter((u) => u.title === "Principal")).toHaveLength(1);
  });

  test("a second Principal for the same school is rejected", () => {
    const e = validateUser({ schoolCode: "S001", name: "New Person", email: "new.person@school.example", position: "Principal", modules: [] });
    expect(e.position).toMatch(/already the Principal/);
  });

  test("school is required and the email must be unique", () => {
    const e = validateUser({ schoolCode: "", name: "X", email: "alicia.tan@school.example", position: "School Admin", modules: [] });
    expect(e).toMatchObject({ schoolCode: expect.any(String), name: expect.any(String), email: "This email already has an account." });
  });

  test("admins get only the modules they were assigned; the Principal gets all", () => {
    const admin = createSchoolUser({ schoolCode: "S002", name: "Test Admin", email: "test.admin@school.example", position: "School Admin", modules: ["Top-up"] });
    expect(admin.modules).toEqual(["Top-up"]);
    updateSchoolUser(admin, { name: "Test Admin", email: admin.email, position: "School Admin", modules: ["FAS", "Top-up"] });
    expect(admin.modules).toEqual(["FAS", "Top-up"]);
    const principal = saveSchoolUser("S002", "Test Principal", "test.principal@school.example");
    expect(principal.modules).toEqual(["FAS", "Top-up"]);
    expect(principalOf("S002")).toBe(principal);
    STAFF.splice(STAFF.indexOf(admin), 1);
    STAFF.splice(STAFF.indexOf(principal), 1);
  });
});

describe("navigation follows module permissions", () => {
  const labels = (can: (m: "FAS" | "Top-up") => boolean, manage = false) => navFor("school", { can, canManageUsers: manage }).map((n) => n.label);
  test("FAS-only admin sees FAS but not Top-up or User", () => {
    const l = labels((m) => m === "FAS");
    expect(l).toContain("FAS");
    expect(l).not.toContain("Top-up");
    expect(l).not.toContain("User");
  });
  test("Principal sees every module and User", () => {
    expect(labels(() => true, true)).toEqual(expect.arrayContaining(["FAS", "Top-up", "User"]));
  });
  test("Budget is shown to HQ and to school users with the FAS module only", () => {
    expect(navFor("hq").map((n) => n.label)).toContain("Budget");
    expect(labels((m) => m === "FAS")).toContain("Budget");
    expect(labels((m) => m === "Top-up")).not.toContain("Budget");
  });
  test("HQ sees User management", () => {
    expect(navFor("hq").map((n) => n.label)).toContain("User");
  });
});
