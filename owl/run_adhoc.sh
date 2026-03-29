#!/bin/bash

docker compose exec moodle php admin/cli/adhoc_task.php --execute
