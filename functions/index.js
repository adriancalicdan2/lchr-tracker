const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.deleteEmployee = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated to delete employees",
    );
  }

  const {employeeId} = data;

  if (!employeeId) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Employee ID is required",
    );
  }

  try {
    console.log(`Deleting employee: ${employeeId} requested by: ${context.auth.uid}`);

    // Get employee data to find the UID
    const employeeDoc = await admin.firestore()
        .collection("employees")
        .doc(employeeId)
        .get();
    if (!employeeDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Employee not found");
    }

    const employeeData = employeeDoc.data();
    const employeeUid = employeeData.uid;

    console.log(`Found employee: ${employeeData.name} with UID: ${employeeUid}`);

    // Delete Firestore document
    await admin.firestore().collection("employees").doc(employeeId).delete();
    console.log("Firestore document deleted successfully");

    // Delete Authentication user
    await admin.auth().deleteUser(employeeUid);
    console.log("Authentication user deleted successfully");

    // Also delete any requests associated with this employee
    const leaveRequestsQuery = admin.firestore()
        .collection("leaveRequests")
        .where("employeeId", "==", employeeData.employeeId);
    const overtimeRequestsQuery = admin.firestore()
        .collection("overtimeRequests")
        .where("employeeId", "==", employeeData.employeeId);

    const [leaveRequests, overtimeRequests] = await Promise.all([
      leaveRequestsQuery.get(),
      overtimeRequestsQuery.get(),
    ]);

    // Delete leave requests
    const leaveDeletePromises = [];
    leaveRequests.forEach((doc) => {
      leaveDeletePromises.push(doc.ref.delete());
    });

    // Delete overtime requests
    const overtimeDeletePromises = [];
    overtimeRequests.forEach((doc) => {
      overtimeDeletePromises.push(doc.ref.delete());
    });

    await Promise.all([...leaveDeletePromises, ...overtimeDeletePromises]);
    console.log(`Deleted ${leaveRequests.size} leave requests and ${
      overtimeRequests.size} overtime requests`);

    return {
      success: true,
      message: `Employee ${employeeData.name} and all associated data deleted successfully`,
      deletedRequests: leaveRequests.size + overtimeRequests.size,
    };
  } catch (error) {
    console.error("Error deleting employee:", error);

    if (error.code === "auth/user-not-found") {
      throw new functions.https.HttpsError("not-found", "Authentication user not found");
    }

    throw new functions.https.HttpsError("internal", `Failed to delete employee: ${error.message}`);
  }
});
