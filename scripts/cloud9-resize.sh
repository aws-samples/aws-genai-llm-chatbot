#!/bin/bash

# Specify the desired volume size in GiB as a command line argument. If not specified, default to 20 GiB.
SIZE=${2:-120}

VERSIONID=$(awk /VERSION_ID=/ /etc/os-release |cut -d \" -f 2)

if [[ "$VERSIONID" == "2023" || "$VERSIONID" == "22.04" ]]; then
  # Get the METADATA INSTANCE V2 token
  TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
  # Get the ID of the environment host Amazon EC2 instance.
  INSTANCEID=$(curl -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/instance-id 2> /dev/null)
  REGION=$(curl -H "X-aws-ec2-metadata-token: $TOKEN" -s http://169.254.169.254/latest/meta-data/placement/availability-zone | sed 's/\(.*\)[a-z]/\1/' 2> /dev/null)
else
  # Get the ID of the environment host Amazon EC2 instance.
  INSTANCEID=$(curl http://169.254.169.254/latest/meta-data/instance-id 2> /dev/null)
  REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/availability-zone | sed 's/\(.*\)[a-z]/\1/' 2> /dev/null)
fi

echo "EBS Volume Resizer $REGION/$INSTANCEID"

# List the EBS volumes attached to the instance.
# Get the ID of the Amazon EBS volume associated with the instance.
VOLUMES=$(aws ec2 describe-instances \
  --instance-id $INSTANCEID \
  --query "Reservations[0].Instances[0].BlockDeviceMappings[*].Ebs.VolumeId" \
  --output text \
  --region $REGION)


if [ -z "$1" ]; then
  # Prompt for the volume to use.
  echo "EBS Volumes:"
  PS3='Please select the EBS volume to resize (e.g 1) : '
  select VOLUME_ID in $VOLUMES; do
    break
  done
else
  VOLUME_ID=${VOLUMES[0]}
fi

# verifying whether a valid EBS volume was selected.
if [ -z "${VOLUME_ID}" ]; then
  echo "The selected volume is invalid.";
  exit 1;
fi 

if [ -z "$2" ]; then
  # Prompting for the size in GiB to resize the EBS volume.
  read -p "Enter new EBS Storage in GiB (e.g '$SIZE') for '$VOLUME_ID': " SIZE
else
  SIZE=$2
fi

# Verify whether the input is a number.
if [[ -n ${SIZE//[0-9]/} ]]; then
  echo "Invalid input. Enter a valid numerical value."
  exit 1
fi

# Ensure the new size is superior or equal to 100 GB.
if [ "$SIZE" -lt "100" ]; then
  echo "The new size must be superior or equal to 100 GiB."
  exit 1
fi

if [ -z "$1" ]; then
  # Confirm the input.
  read -p "Resizing EBS Storage to $SIZE (GiB), continue? (Y/N): " confirm
  if [[ $confirm != [yY] && $confirm != [yY][eE][sS] ]]; then
    echo "Exiting..."
    exit 1
  fi
fi

# Resize the EBS volume.
echo "Resizing volume $VOLUME_ID to $SIZE GiB..."
RESULT=$(aws ec2 modify-volume --volume-id $VOLUME_ID --size $SIZE 2>&1)
if [ $? -ne 0 ]; then
    echo "Failed to modify the volume. Error: $RESULT"
    exit 1
fi

# Wait for the resize to finish.
while [ \
  "$(aws ec2 describe-volumes-modifications \
    --volume-id $VOLUME_ID \
    --filters Name=modification-state,Values="optimizing","completed" \
    --query "length(VolumesModifications)"\
    --output text)" != "1" ]; do
sleep 1
done

#Check if we're on an NVMe filesystem
if [[ -e "/dev/xvda" && $(readlink -f /dev/xvda) = "/dev/xvda" ]]
then
  # Rewrite the partition table so that the partition takes up all the space that it can.
  sudo growpart /dev/xvda 1
  # Expand the size of the file system.
  # Check if we're on AL2023 or 2
  if [[ "$VERSIONID" == "2023" || "$VERSIONID" == "2" ]]
  then
    sudo xfs_growfs -d /
  else
    sudo resize2fs /dev/xvda1
  fi
else
  # Rewrite the partition table so that the partition takes up all the space that it can.
  sudo growpart /dev/nvme0n1 1
  # Expand the size of the file system.
  # Check if we're on AL2023 or 2
  if [[ "$VERSIONID" == "2023" || "$VERSIONID" == "2" ]]
  then
    sudo xfs_growfs -d /
  else
    sudo resize2fs /dev/nvme0n1p1
  fi
fi
