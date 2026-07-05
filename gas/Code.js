/**
 * Max Strength Workout Logger - Google Apps Script Backend
 * Exposes JSON API endpoints, uploads files to Google Drive, and uses Google Sheets as database.
 */

// Helper to return CORS-compliant JSON response
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Handle CORS Preflight requests (Options route)
function doOptions(e) {
  return jsonResponse({ status: "ok" });
}

// Get reference to the active sheet, initialize or migrate schemas if necessary
function getDb() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Workouts Sheet Setup
  var workoutsSheet = ss.getSheetByName("Workouts");
  var workoutsHeaders = ["ID", "Date", "Workout Name"];
  if (!workoutsSheet) {
    workoutsSheet = ss.insertSheet("Workouts");
    workoutsSheet.appendRow(workoutsHeaders);
  } else {
    var lastCol = workoutsSheet.getLastColumn();
    var headers = [];
    if (lastCol > 0) {
      headers = workoutsSheet.getRange(1, 1, 1, lastCol).getValues()[0];
    }
    for (var i = 0; i < workoutsHeaders.length; i++) {
      var headerName = workoutsHeaders[i];
      var colIndex = i + 1;
      if (headers.length < colIndex || !headers[i] || headers[i].toString().trim().toLowerCase() !== headerName.toLowerCase()) {
        workoutsSheet.getRange(1, colIndex).setValue(headerName);
      }
    }
  }
  
  // 2. Exercises Sheet Setup
  var exercisesSheet = ss.getSheetByName("Exercises");
  var exercisesHeaders = ["Workout ID", "Exercise", "Weight", "Unit", "Sets", "Reps", "Notes", "Image URL", "Machine Image URL", "Video URL", "Exercise Notes"];
  if (!exercisesSheet) {
    exercisesSheet = ss.insertSheet("Exercises");
    exercisesSheet.appendRow(exercisesHeaders);
  } else {
    var lastCol = exercisesSheet.getLastColumn();
    var headers = [];
    if (lastCol > 0) {
      headers = exercisesSheet.getRange(1, 1, 1, lastCol).getValues()[0];
    }
    
    // Check and set each expected column index header if not present or named incorrectly
    for (var i = 0; i < exercisesHeaders.length; i++) {
      var headerName = exercisesHeaders[i];
      var colIndex = i + 1;
      if (headers.length < colIndex || !headers[i] || headers[i].toString().trim().toLowerCase() !== headerName.toLowerCase()) {
        exercisesSheet.getRange(1, colIndex).setValue(headerName);
      }
    }
  }
  
  return {
    workouts: workoutsSheet,
    exercises: exercisesSheet
  };
}

// Entrypoint for GET requests
function doGet(e) {
  var action = e.parameter.action;
  var db = getDb();
  
  try {
    if (action === "getWorkouts") {
      return jsonResponse(getWorkoutsList(db));
    } 
    else if (action === "getWorkoutDetail") {
      var id = e.parameter.id;
      if (!id) throw new Error("Missing 'id' parameter");
      return jsonResponse(getWorkoutDetail(db, id));
    } 
    else if (action === "getExerciseHistory") {
      var name = e.parameter.name;
      if (!name) throw new Error("Missing 'name' parameter");
      return jsonResponse(getExerciseHistory(db, name));
    } 
    else if (action === "getExerciseSuggestions") {
      return jsonResponse(getExerciseSuggestions(db));
    } 
    else {
      return jsonResponse({ error: "Unknown action: " + action });
    }
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

// Entrypoint for POST requests
function doPost(e) {
  var db = getDb();
  
  try {
    if (!e.postData || !e.postData.contents) {
      throw new Error("Empty body payload");
    }
    
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    
    if (action === "createWorkout") {
      return jsonResponse(createWorkout(db, payload.data));
    } 
    else if (action === "updateWorkout") {
      return jsonResponse(updateWorkout(db, payload.id, payload.data));
    } 
    else if (action === "deleteWorkout") {
      return jsonResponse(deleteWorkout(db, payload.id));
    } 
    else if (action === "uploadFile") {
      return jsonResponse(uploadFileToDrive(payload.data));
    }
    else if (action === "deleteFile") {
      return jsonResponse(deleteFileByUrl(payload.url));
    }
    else if (action === "updateExerciseDetails") {
      return jsonResponse(updateExerciseDetails(db, payload.name, payload.imageUrl, payload.machineImageUrl, payload.videoUrl, payload.exerciseNotes));
    }
    else {
      return jsonResponse({ error: "Unknown POST action: " + action });
    }
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

// --- API ACTIONS HANDLERS ---

// GET /workouts
function getWorkoutsList(db) {
  var workoutsRange = db.workouts.getDataRange();
  var workoutsValues = workoutsRange.getValues();
  
  var exercisesRange = db.exercises.getDataRange();
  var exercisesValues = exercisesRange.getValues();
  
  // Count exercises for each Workout ID
  var exerciseCounts = {};
  for (var i = 1; i < exercisesValues.length; i++) {
    var workoutId = exercisesValues[i][0];
    exerciseCounts[workoutId] = (exerciseCounts[workoutId] || 0) + 1;
  }
  
  var list = [];
  // Start from 1 to skip heading
  for (var i = 1; i < workoutsValues.length; i++) {
    var row = workoutsValues[i];
    var id = row[0];
    list.push({
      id: id,
      date: row[1], // Expected YYYY-MM-DD
      name: row[2],
      exerciseCount: exerciseCounts[id] || 0
    });
  }
  
  // Sort by date desc, then by row order index desc
  list.sort(function(a, b) {
    var dateA = new Date(a.date);
    var dateB = new Date(b.date);
    if (dateA.getTime() !== dateB.getTime()) {
      return dateB.getTime() - dateA.getTime();
    }
    return b.id.localeCompare(a.id); // Tiebreaker
  });
  
  return list;
}

// GET /workouts/:id
function getWorkoutDetail(db, id) {
  var workoutsValues = db.workouts.getDataRange().getValues();
  var workoutRowIndex = -1;
  
  for (var i = 1; i < workoutsValues.length; i++) {
    if (workoutsValues[i][0] === id) {
      workoutRowIndex = i;
      break;
    }
  }
  
  if (workoutRowIndex === -1) {
    throw new Error("Workout not found: " + id);
  }
  
  var workoutRow = workoutsValues[workoutRowIndex];
  var workout = {
    id: workoutRow[0],
    date: workoutRow[1],
    name: workoutRow[2],
    exercises: []
  };
  
  var exercisesValues = db.exercises.getDataRange().getValues();
  for (var i = 1; i < exercisesValues.length; i++) {
    var row = exercisesValues[i];
    if (row[0] === id) {
      workout.exercises.push({
        name: row[1] || "",
        weight: row[2] !== undefined ? row[2].toString() : "0", // Preserve strings like "BW + 6"
        unit: row[3] || "kg",
        sets: Number(row[4] || 0),
        reps: Number(row[5] || 0),
        notes: row[6] || "",
        imageUrl: row[7] || "",
        machineImageUrl: row[8] || "",
        videoUrl: row[9] || "",
        exerciseNotes: row[10] || ""
      });
    }
  }
  
  return workout;
}

// GET /exerciseHistory?name=
function getExerciseHistory(db, name) {
  var workoutsValues = db.workouts.getDataRange().getValues();
  // Map workoutId -> Date
  var workoutDates = {};
  for (var i = 1; i < workoutsValues.length; i++) {
    workoutDates[workoutsValues[i][0]] = workoutsValues[i][1];
  }
  
  var exercisesValues = db.exercises.getDataRange().getValues();
  var history = [];
  var targetName = name.toLowerCase().trim();
  
  for (var i = 1; i < exercisesValues.length; i++) {
    var row = exercisesValues[i];
    var exerciseName = row[1] ? row[1].toString().toLowerCase().trim() : "";
    if (exerciseName === targetName) {
      var wId = row[0];
      var dateStr = workoutDates[wId];
      if (dateStr) {
        history.push({
          date: dateStr,
          weight: row[2] !== undefined ? row[2].toString() : "0",
          unit: row[3] || "kg",
          sets: Number(row[4] || 0),
          reps: Number(row[5] || 0),
          notes: row[6] || "",
          imageUrl: row[7] || "",
          machineImageUrl: row[8] || "",
          videoUrl: row[9] || "",
          exerciseNotes: row[10] || ""
        });
      }
    }
  }
  
  // Sort history chronologically
  history.sort(function(a, b) {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });
  
  return history;
}

// GET /exerciseSuggestions
function getExerciseSuggestions(db) {
  var workoutsValues = db.workouts.getDataRange().getValues();
  // Map workoutId -> Date (string)
  var workoutDates = {};
  for (var i = 1; i < workoutsValues.length; i++) {
    workoutDates[workoutsValues[i][0]] = workoutsValues[i][1];
  }
  
  var exercisesValues = db.exercises.getDataRange().getValues();
  var latestPerformance = {};
  
  for (var i = 1; i < exercisesValues.length; i++) {
    var row = exercisesValues[i];
    var exName = row[1] ? row[1].toString().trim() : "";
    var workoutId = row[0];
    var dateStr = workoutDates[workoutId];
    
    if (!dateStr || !exName) continue;
    
    var currentItemDate = new Date(dateStr).getTime();
    var nameLower = exName.toLowerCase();
    
    if (!latestPerformance[nameLower] || currentItemDate > latestPerformance[nameLower].dateTime) {
      latestPerformance[nameLower] = {
        name: exName, // Original case
        weight: row[2] !== undefined ? row[2].toString() : "0",
        unit: row[3] || "kg",
        sets: Number(row[4] || 0),
        reps: Number(row[5] || 0),
        notes: row[6] || "",
        imageUrl: row[7] || "",
        machineImageUrl: row[8] || "",
        videoUrl: row[9] || "",
        exerciseNotes: row[10] || "",
        dateTime: currentItemDate,
        date: dateStr
      };
    }
  }
  
  // Convert dict to list
  var suggestions = [];
  for (var key in latestPerformance) {
    var item = latestPerformance[key];
    suggestions.push({
      name: item.name,
      weight: item.weight,
      unit: item.unit,
      sets: item.sets,
      reps: item.reps,
      notes: item.notes,
      imageUrl: item.imageUrl,
      machineImageUrl: item.machineImageUrl,
      videoUrl: item.videoUrl,
      exerciseNotes: item.exerciseNotes,
      date: item.date
    });
  }
  
  // Sort alphabetically
  suggestions.sort(function(a, b) {
    return a.name.localeCompare(b.name);
  });
  
  return suggestions;
}

// POST /workouts (create)
function createWorkout(db, workout) {
  var id = workout.id || Utilities.getUuid();
  var dateStr = workout.date; // YYYY-MM-DD
  var name = workout.name;
  
  // Write to Workouts sheet
  db.workouts.appendRow([id, dateStr, name]);
  
  // Write Exercises to Exercises sheet
  var exercises = workout.exercises || [];
  for (var i = 0; i < exercises.length; i++) {
    var ex = exercises[i];
    db.exercises.appendRow([
      id,
      ex.name.trim(),
      ex.weight ? ex.weight.toString().trim() : "0",
      ex.unit || "kg",
      Number(ex.sets || 0),
      Number(ex.reps || 0),
      ex.notes ? ex.notes.trim() : "",
      ex.imageUrl ? ex.imageUrl.trim() : "",
      ex.machineImageUrl ? ex.machineImageUrl.trim() : "",
      ex.videoUrl ? ex.videoUrl.trim() : "",
      ex.exerciseNotes ? ex.exerciseNotes.trim() : ""
    ]);
  }
  
  return { success: true, id: id };
}

// POST /workouts/:id (update)
function updateWorkout(db, id, workout) {
  // Find workout row
  var workoutsValues = db.workouts.getDataRange().getValues();
  var workoutRowIndex = -1;
  
  for (var i = 1; i < workoutsValues.length; i++) {
    if (workoutsValues[i][0] === id) {
      workoutRowIndex = i + 1; // 1-based index for sheets API
      break;
    }
  }
  
  if (workoutRowIndex === -1) {
    throw new Error("Workout not found for update: " + id);
  }
  
  // Update Workouts sheet values (row number matches workoutRowIndex)
  db.workouts.getRange(workoutRowIndex, 2, 1, 2).setValues([[workout.date, workout.name]]);
  
  // Remove existing exercises associated with this workout
  var exercisesSheet = db.exercises;
  var exercisesValues = exercisesSheet.getDataRange().getValues();
  
  // Delete matching exercise rows backwards to preserve row indices
  for (var i = exercisesValues.length - 1; i >= 1; i--) {
    if (exercisesValues[i][0] === id) {
      exercisesSheet.deleteRow(i + 1); // 1-based index
    }
  }
  
  // Append new exercises list
  var exercises = workout.exercises || [];
  for (var i = 0; i < exercises.length; i++) {
    var ex = exercises[i];
    exercisesSheet.appendRow([
      id,
      ex.name.trim(),
      ex.weight ? ex.weight.toString().trim() : "0",
      ex.unit || "kg",
      Number(ex.sets || 0),
      Number(ex.reps || 0),
      ex.notes ? ex.notes.trim() : "",
      ex.imageUrl ? ex.imageUrl.trim() : "",
      ex.machineImageUrl ? ex.machineImageUrl.trim() : "",
      ex.videoUrl ? ex.videoUrl.trim() : "",
      ex.exerciseNotes ? ex.exerciseNotes.trim() : ""
    ]);
  }
  
  return { success: true };
}

// POST /workouts/:id (delete)
function deleteWorkout(db, id) {
  // Delete from Workouts sheet
  var workoutsSheet = db.workouts;
  var workoutsValues = workoutsSheet.getDataRange().getValues();
  var workoutDeleted = false;
  
  for (var i = workoutsValues.length - 1; i >= 1; i--) {
    if (workoutsValues[i][0] === id) {
      workoutsSheet.deleteRow(i + 1);
      workoutDeleted = true;
    }
  }
  
  if (!workoutDeleted) {
    throw new Error("Workout not found for deletion: " + id);
  }
  
  // Delete from Exercises sheet
  var exercisesSheet = db.exercises;
  var exercisesValues = exercisesSheet.getDataRange().getValues();
  for (var i = exercisesValues.length - 1; i >= 1; i--) {
    if (exercisesValues[i][0] === id) {
      exercisesSheet.deleteRow(i + 1);
    }
  }
  
  return { success: true };
}

// Upload file to Google Drive and return sharing URL
function uploadFileToDrive(payload) {
  var base64Data = payload.base64Data;
  var filename = payload.filename || "upload";
  var mimeType = payload.mimeType || "application/octet-stream";
  
  // Strip standard base64 data URL signature if present
  if (base64Data.indexOf("base64,") !== -1) {
    base64Data = base64Data.split("base64,")[1];
  }
  
  var decoded = Utilities.base64Decode(base64Data);
  var blob = Utilities.newBlob(decoded, mimeType, filename);
  
  // Find or create Folder
  var folderName = "Max Strength Media";
  var folders = DriveApp.getFoldersByName(folderName);
  var folder;
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(folderName);
  }
  
  var file = folder.createFile(blob);
  // Set permissions: Anyone with link can view (allows app display)
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  var fileId = file.getId();
  var downloadUrl = "https://docs.google.com/uc?export=download&id=" + fileId;
  var viewUrl = file.getUrl();
  
  return {
    success: true,
    fileId: fileId,
    viewUrl: viewUrl,
    downloadUrl: downloadUrl
  };
}

// Delete (trash) a file from Google Drive and return success status
function deleteFileFromDrive(fileId) {
  try {
    var file = DriveApp.getFileById(fileId);
    file.setTrashed(true);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

// Extract file ID from google drive share links and delete it
function deleteFileByUrl(url) {
  if (!url) return { success: false, error: "Empty URL" };
  // Search for standard ID patterns e.g: id=xxxx or /d/xxxx/
  var match = url.match(/id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return deleteFileFromDrive(match[1]);
  }
  return { success: false, error: "Could not parse Google Drive file ID from URL: " + url };
}

// Update specific exercise details across all logs
function updateExerciseDetails(db, name, imageUrl, machineImageUrl, videoUrl, exerciseNotes) {
  var exercisesSheet = db.exercises;
  var range = exercisesSheet.getDataRange();
  var values = range.getValues();
  var targetName = name.toLowerCase().trim();
  var updatedCount = 0;
  
  for (var i = 1; i < values.length; i++) {
    var exName = values[i][1];
    if (exName && exName.toLowerCase().trim() === targetName) {
      var rowNum = i + 1; // 1-based index
      
      // Update Image URL (col 8)
      if (imageUrl !== undefined && imageUrl !== null) {
        exercisesSheet.getRange(rowNum, 8).setValue(imageUrl);
      }
      
      // Update Machine Image URL (col 9)
      if (machineImageUrl !== undefined && machineImageUrl !== null) {
        exercisesSheet.getRange(rowNum, 9).setValue(machineImageUrl);
      }
      
      // Update Video URL (col 10)
      if (videoUrl !== undefined && videoUrl !== null) {
        exercisesSheet.getRange(rowNum, 10).setValue(videoUrl);
      }

      // Update Exercise Notes (col 11)
      if (exerciseNotes !== undefined && exerciseNotes !== null) {
        exercisesSheet.getRange(rowNum, 11).setValue(exerciseNotes);
      }
      
      updatedCount++;
    }
  }
  
  return { success: true, updatedCount: updatedCount };
}
