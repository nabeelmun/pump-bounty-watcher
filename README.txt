================================================================
 RUN THE BOUNTY WATCHER FREE ON GITHUB  (laptop can be OFF)
================================================================

GitHub will run the watcher in the cloud on a timer (about every
5 minutes) for free. No server, no payment, laptop can be off.
Trade-off vs the VPS: alerts come within ~5 min instead of seconds.

You'll do this all on the GitHub WEBSITE - no commands, no install.
Your phone setup does NOT change (same ntfy topic + app).

Why "Public" repo: GitHub gives UNLIMITED free minutes to public
repositories, but only ~2,000 min/month to private ones (not enough
for a 5-minute timer). So we use a PUBLIC repo and keep your topic
hidden in a "Secret" instead of in the code.


----------------------------------------------------------------
STEP 1 - Create the repository
----------------------------------------------------------------
1. Go to https://github.com/new
2. Repository name:  pump-bounty-watcher
3. Choose **Public**.
4. Do NOT add a README/gitignore/license (leave unchecked).
5. Click "Create repository".


----------------------------------------------------------------
STEP 2 - Upload the code files
----------------------------------------------------------------
On the new empty repo page, click the link
   "uploading an existing file"
(or the "Add file" button -> "Upload files").

Drag in these TWO files from this folder:
   watcher.mjs
   config.json

Then click "Commit changes" (green button).

(You do NOT need to upload seen.json, the .bat files, the vps
 folder, or node_modules - only those two files.)


----------------------------------------------------------------
STEP 3 - Add the timer (the workflow file)
----------------------------------------------------------------
This file must sit in a specific folder, so we'll create it by hand:

1. On the repo page click "Add file" -> "Create new file".
2. In the filename box at the top, type EXACTLY (slashes included):

       .github/workflows/watch.yml

   (As you type the slashes, GitHub turns them into folders.)
3. Open the file "watch.yml" from this folder on your PC (Notepad),
   copy ALL of it, and paste it into the big box on GitHub.
4. Click "Commit changes".


----------------------------------------------------------------
STEP 4 - Hide your phone topic as a Secret
----------------------------------------------------------------
1. In the repo, click "Settings" (top menu).
2. Left side: "Secrets and variables" -> "Actions".
3. Click "New repository secret".
4. Name:    NTFY_TOPIC
   Secret:  pump-bounties-da1366d1c3
5. Click "Add secret".

(The code reads the topic from this secret, so it's never shown
 publicly. To use a different topic later, change it here AND
 re-subscribe in the ntfy app.)


----------------------------------------------------------------
STEP 5 - Turn it on and test
----------------------------------------------------------------
1. Click the "Actions" tab.
2. If GitHub shows a green "I understand my workflows, enable them"
   button, click it.
3. On the left, click the workflow "pump bounty watch".
4. Click "Run workflow" -> "Run workflow" (this runs it once now).
5. Wait ~30-60 seconds, refresh. A run appears with a green check.
   - The FIRST run records the bounties that already exist and
     sends you a "watcher is live" notification.
   - From then on it runs every ~5 minutes on its own and pings
     you for each NEW bounty.

If you didn't get the "live" notification, open the run, click the
"check" job, and read the log for errors (usually a wrong topic).


----------------------------------------------------------------
GOOD TO KNOW
----------------------------------------------------------------
- Timing: GitHub's free timer fires roughly every 5 min, sometimes
  a few minutes late when GitHub is busy. Normal.
- It keeps a file "seen.json" in your repo so it never alerts you
  about the same bounty twice. You'll see small auto-commits from
  "bounty-bot" - that's expected.
- GitHub pauses timers after 60 days with NO commits. The bot's own
  commits (whenever a new bounty appears) reset that clock, so an
  active bounty board keeps it alive. If bounties ever go quiet for
  60+ days, just press "Run workflow" once to wake it back up.
- Change settings: edit config.json on GitHub (pencil icon) - e.g.
  "minRewardUsd": 100 to only get alerts for bounties worth >= $100.
  (Leave ntfyTopic alone; the Secret is what's used.)
- Cost: $0. Public repos get unlimited Actions minutes.

This is fully separate from the laptop/VPS versions. Run only ONE
of them at a time, or the same topic will alert you more than once.
================================================================
