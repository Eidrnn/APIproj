
| Method | Path | Purpose | Maps to Need |
|---|---|---|---|
| GET | /users | Return all user profiles | Team 8 needs to retrieve user profiles in order to identify and manage individual users on their expenditure management app. |
| GET | /categories | Return the list of fitness-related expense categories (e.g., gym memberships, equipment, activities) | Team 8 needs to retrieve fitness-related expense categories in order to allow users to track spending on gym memberships, fitness equipment, and other fitness activities. |
| POST | /expenses | Create a new fitness expense record | Team 8 needs to create fitness expense records in order to allow users to record and manage their fitness-related spending.|
| PUT | /expenses/{expenseId} | Update an existing fitness expense record | Team 8 needs to update fitness expense records in order to allow users to correct or modify previously recorded expenditure. |
| GET | /users/{userId}/expenses/summary?month={month} | Return a user's total fitness spending against their monthly allowance | Team 8 needs to retrieve fitness spending data in order to help users monitor how much of their monthly allowance is being spent on fitness activities.|
| DELETE | /expenses/{expenseId} | Remove a fitness expense record | Team 8 needs to delete fitness expense records in order to allow users to remove incorrect or unwanted expenditure records. |

