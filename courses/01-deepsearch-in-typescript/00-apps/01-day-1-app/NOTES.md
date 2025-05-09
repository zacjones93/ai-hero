# CrossFit Workout Application Notes

## Application Purpose

- Manage CrossFit workouts (WODs).

## Database Requirements

### WODs (Workouts of the Day)

- Store various WODs.
- Each WOD can have different scoring schemes.

### Scoring Schemes

- **AMRAP:** As Many Reps/Rounds As Possible
- **For Time:** Complete the workout as fast as possible.
- **For Reps:** Complete as many repetitions as possible (often within a time limit, or for a specific movement).
- **For Load:** Lift the heaviest possible weight (e.g., 1 Rep Max).
- **For Rounds:** Complete a specific number of rounds.
- **For Points:** Score points based on performance in various parts of the workout.
- **EMOM (Every Minute On the Minute) Pass/Fail:** Complete a task every minute on the minute, typically scored as pass or fail for each interval or overall.

## Technology Stack

- **Cloud Platform:** Cloudflare
- **Database:** Cloudflare D1
- **Routing:** React Router
- **ORM:** Drizzle ORM
- **Styling:** Tailwind CSS
