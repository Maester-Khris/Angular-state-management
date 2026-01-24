#### Model description
- user: avatarUrl, createdAt, status, bio, name, email, password, useruuid
- post: uuid, authorid, editorids, createdAt, lastEditedAt, creator, images, description, title, hashtag

#### Post crud method
- 

#### Post edition


### summary collection writing policy
For the Stats Summary: Every time a view is recorded in the Time-Series, you also fire an atomic $inc update to the UserStatsSummary.
For the Contribution Grid: This is best handled by a daily rollup
Active Contributions (the user creating, editing, or co-authoring a post).
   