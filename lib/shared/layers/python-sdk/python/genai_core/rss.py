import os
import boto3
import botocore
import uuid
import json
import hashlib
from aws_lambda_powertools import Logger, Tracer
import genai_core.documents
import feedparser
from datetime import datetime


logger = Logger()
tracer = Tracer()

scheduler = boto3.client('scheduler')
dynamodb = boto3.client('dynamodb')

timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%fZ")

RSS_SCHEDULE_GROUP_NAME = os.environ['RSS_SCHEDULE_GROUP_NAME'] if "RSS_SCHEDULE_GROUP_NAME" in os.environ else ""
RSS_FEED_TABLE = os.environ['RSS_FEED_TABLE'] if "RSS_FEED_TABLE" in os.environ else ""
RSS_FEED_INGESTOR_FUNCTION = os.environ['RSS_FEED_INGESTOR_FUNCTION'] if "RSS_FEED_INGESTOR_FUNCTION" in os.environ else ""
RSS_FEED_SCHEDULE_ROLE_ARN = os.environ['RSS_FEED_SCHEDULE_ROLE_ARN'] if "RSS_FEED_SCHEDULE_ROLE_ARN" in os.environ else ""
RSS_FEED_DOCUMENT_TYPE_STATUS_INDEX = os.environ['RSS_FEED_DOCUMENT_TYPE_STATUS_INDEX'] if "RSS_FEED_DOCUMENT_TYPE_STATUS_INDEX" in os.environ else ""
RSS_FEED_WORKSPACE_DOCUMENT_TYPE_INDEX = os.environ['RSS_FEED_WORKSPACE_DOCUMENT_TYPE_INDEX'] if "RSS_FEED_WORKSPACE_DOCUMENT_TYPE_INDEX" in os.environ else ""

#TODO - Add Exception Handling
@tracer.capture_method
def create_rss_subscription(workspace_id, rss_feed_url, rss_feed_title):
    logger.info(f'Creating RSS Subscription for workspace_id {workspace_id} and rss_feed_url {rss_feed_url}')
    try:
        rss_feed_id = _get_id_for_url(rss_feed_url)
        schedule_id = str(uuid.uuid4())
        dynamodb.put_item(
            TableName=RSS_FEED_TABLE,
            Item={
                'workspace_id' : {
                    'S': workspace_id
                },
                'compound_sort_key' : {
                    'S': f'feed_id.{rss_feed_id}'
                },
                'feed_id': {
                    'S': rss_feed_id
                },
                'url': {
                    'S': rss_feed_url
                },
                'title': {
                    'S': rss_feed_title
                },
                'document_type': {
                    'S': 'feed'
                },
                'status': {
                    'S': 'enabled'
                },
                'created_at': {
                    'S': timestamp
                },
                'schedule_id' : {
                    'S': schedule_id
                }
            },
        )
        logger.info(f'Created RSS Subscription for workspace_id {workspace_id} and url {rss_feed_url}')
        logger.info('Creating schedule for feed polling')
        scheduler_response = scheduler.create_schedule(
            ActionAfterCompletion= 'NONE',
            Name=schedule_id,
            Description=f'RSS Feed Subscription for GenAI Website Crawling',
            GroupName=RSS_SCHEDULE_GROUP_NAME,
            ScheduleExpression='rate(1 day)',
            Target={
                'Arn': RSS_FEED_INGESTOR_FUNCTION,
                'Input': json.dumps({'workspace_id': workspace_id, 'feed_id': rss_feed_id}),
                'RoleArn': RSS_FEED_SCHEDULE_ROLE_ARN
            },
            FlexibleTimeWindow={
                'MaximumWindowInMinutes': 120,
                'Mode':'FLEXIBLE'
            },
            
        )
        logger.debug(scheduler_response)
        try:
            logger.info(f'Attempting to start first RSS Feed Crawl')
            lambda_client = boto3.client('lambda')
            lambda_client.invoke(
                FunctionName=RSS_FEED_INGESTOR_FUNCTION,
                InvocationType='Event',
                Payload=json.dumps({
                    "workspace_id": workspace_id,
                    "feed_id": rss_feed_id
                })
            )
        except botocore.exceptions.ClientError as lambda_error:
            logger.error(lambda_error)
            

    except botocore.exceptions.ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            logger.info(f'RSS Subscription for workspace_id {workspace_id} and url {rss_feed_url} already exists')
        else:
            raise


@tracer.capture_method
def disable_rss_subscription(workspace_id, feed_id):
    '''Disables scheduled subscription to RSS Subscription'''
    logger.info(f'Disabling RSS Subscription for workspace_id {workspace_id} and feed_id {feed_id}')
    _toggle_rss_subscription_status(workspace_id, feed_id, 'disabled')
    logger.info(f'Successfully disabled RSS Subscription for workspace_id {workspace_id} and feed_id {feed_id}')
    return {
        'status': 'success'
    }


@tracer.capture_method
def enable_rss_subscription(workspace_id, feed_id):
    '''Enables scheduled subscription to RSS Subscription'''
    logger.info(f'Enabling RSS Subscription for workspace_id {workspace_id} and feed_id {feed_id}')
    _toggle_rss_subscription_status(workspace_id, feed_id, 'enabled')
    logger.info(f'Successfully enabled RSS Subscription for workspace_id {workspace_id} and feed_id {feed_id}')
    return {
        'status': 'success'
    }

def _toggle_rss_subscription_status(workspace_id, feed_id, status):
    logger.info(f'Toggling RSS Subscription for workspace_id {workspace_id} and feed_id {feed_id} to {status}')
    if status.lower() == 'enabled' or status.lower() == 'disabled':
        updated_subscription = dynamodb.update_item(
            TableName=RSS_FEED_TABLE,
            Key={
                'workspace_id': {
                    'S': workspace_id
                },
                'compound_sort_key': {
                    'S': f'feed_id.{feed_id}'
                }
            },
            UpdateExpression='SET #status = :status',
            ExpressionAttributeNames={
                '#status': 'status',
            },
            ExpressionAttributeValues={
                ':status': {
                    'S': status
                }
            },
            ReturnValues='ALL_NEW'            
        )
        logger.info(f'Updated status for {feed_id} to {status} in DynamoDB')
        if 'Attributes' in updated_subscription and 'schedule_id' in updated_subscription['Attributes']:
            schedule_id = updated_subscription['Attributes']['schedule_id']['S']
            logger.info(f'Updating scheduler status for {feed_id} to {status}')
            scheduler_response = scheduler.update_schedule(
                ActionAfterCompletion= 'NONE',
                Name=schedule_id,
                State=status.upper(),
                Description=f'RSS Feed Subscription for GenAI Website Crawling',
                GroupName=RSS_SCHEDULE_GROUP_NAME,
                ScheduleExpression='rate(1 day)',
                Target={
                    'Arn': RSS_FEED_INGESTOR_FUNCTION,
                    'Input': json.dumps({'workspace_id': workspace_id, 'feed_id': feed_id}),
                    'RoleArn': RSS_FEED_SCHEDULE_ROLE_ARN
                },
                FlexibleTimeWindow={
                    'MaximumWindowInMinutes': 120,
                    'Mode':'FLEXIBLE'
                },
            )
            if scheduler_response['ScheduleArn']:
                logger.info(f'Successfully set schedule to {status.lower()} for {feed_id}')
   

@tracer.capture_method
def list_rss_subscriptions(workspace_id):
    '''Provides list of RSS Feed subscriptions for a given workspace'''
    logger.info(f'Getting RSS Subscriptions for workspace_id {workspace_id}')
    subscriptions = dynamodb.query(
            TableName=RSS_FEED_TABLE,
            IndexName=RSS_FEED_WORKSPACE_DOCUMENT_TYPE_INDEX,
            KeyConditionExpression="#workspace_id = :workspace_id and #document_type = :document_type",
            ExpressionAttributeValues={ ":workspace_id": { "S": workspace_id }, ":document_type": { "S": "feed" } }, 
            ExpressionAttributeNames={ "#workspace_id": "workspace_id", "#document_type": "document_type" }
      )
    logger.debug(f'Found {subscriptions["Count"]} RSS Subscriptions')
    if subscriptions['Count'] > 0:
        return [{
            'id': subscription['feed_id']['S'],
            'workspaceId': workspace_id,
            'path': subscription['url']['S'],
            'title': subscription['title']['S'],
            'status': subscription['status']['S'],
        } for subscription in subscriptions['Items']]
    else:
        logger.debug('No RSS Subscriptions found')
        return []

@tracer.capture_method    
def get_rss_subscription_details(workspace_id, feed_id):
    '''Gets details about the RSS feed provided'''
    logger.debug(f'Getting details for RSS Feed {feed_id} in workspace {workspace_id}')
    dynamodb_results = dynamodb.query(
        TableName=RSS_FEED_TABLE,
        KeyConditionExpression="#workspace_id = :workspace_id and begins_with(#compound_sort_key, :feed_id_key)",
        ExpressionAttributeValues={ ":workspace_id": { "S": workspace_id }, ":feed_id_key": { "S": f'feed_id.{feed_id}' } }, 
        ExpressionAttributeNames={ "#workspace_id": "workspace_id", "#compound_sort_key": "compound_sort_key" }
    )
    if dynamodb_results['Count'] > 0:
        return {
            'id': feed_id,
            'workspaceId': workspace_id,
            'path': dynamodb_results['Items'][0]['url']['S'],
            'title': dynamodb_results['Items'][0]['title']['S'],
            'status': dynamodb_results['Items'][0]['status']['S'],
            'createdAt': dynamodb_results['Items'][0]['created_at']['S'] if "created_at" in dynamodb_results['Items'][0] else "",
            'updatedAt': dynamodb_results['Items'][0]['updated_at']['S'] if "updated_at" in dynamodb_results['Items'][0] else ""
        }
    else:
        return None

@tracer.capture_method
def list_posts_for_rss_subscription(workspace_id, feed_id):
    '''Gets a list of posts that the RSS feed subscriber 
        has consumed or will consume
    '''
    logger.debug(f'Getting posts for RSS Feed {feed_id} in workspace {workspace_id}')
    dynamodb_results = dynamodb.query(
        TableName=RSS_FEED_TABLE,
        KeyConditionExpression="#workspace_id = :workspace_id and begins_with(#compound_sort_key, :feed_id_key)",
        ExpressionAttributeValues={ ":workspace_id": { "S": workspace_id }, ":feed_id_key": { "S": f'feed_id.{feed_id}' } }, 
        ExpressionAttributeNames={ "#workspace_id": "workspace_id", "#compound_sort_key": "compound_sort_key" }
    )
    if dynamodb_results['Count'] > 0:
        posts = []
        logger.info(f'{dynamodb_results["Count"]} posts found for {feed_id} in {workspace_id} workspace.')
        logger.debug(dynamodb_results['Items'])
        for item in dynamodb_results['Items']:
            if item['document_type']['S'] == 'post':
                posts.append({
                    "feed_id": feed_id,
                    "workspaceId": workspace_id,
                    "id": item['post_id']['S'],
                    "path": item['url']['S'],
                    "title": item['title']['S'],
                    "status": item['status']['S'],
                    "createdAt": item['created_at']['S'] if "created_at" in item else "",
                    "updatedAt": item['updated_at']['S'] if "updated_at" in item else ""
                }) 
        return posts
    else:
        return []

@tracer.capture_method
def set_rss_post_submitted(workspace_id, feed_id, post_id):
     '''Sets an RSS Feed Post as Submitted'''
     logger.info(f'Setting {post_id} as Ingested')
     return dynamodb.update_item(
          TableName=RSS_FEED_TABLE,
          Key={
               'workspace_id': {
                    'S': workspace_id
               },
               'compound_sort_key': {
                    'S': f'feed_id.{feed_id}.post_id.{post_id}'
               }
          },
          UpdateExpression='SET #status = :status, #updated_at = :updated_at',
          ExpressionAttributeNames={
               '#status': 'status',
               '#updated_at': 'updated_at'
          },
          ExpressionAttributeValues={
               ':status': {
                    'S': 'processed'
               },
               ':updated_at': {
                   'S': timestamp
               }
          }
     )

@tracer.capture_method
def batch_crawl_websites():
    '''Gets next 10 pending posts and sends them to be website crawled
    '''
    posts = _get_batch_pending_posts()
    if posts['Count'] > 0:
        logger.info(f'Found {posts["Count"]} pending posts')
        for post in posts['Items']:
            workspace_id = post['workspace_id']['S']
            feed_id = post['feed_id']['S']
            post_id = post['post_id']['S']
            rss_item_address = post['url']['S']
            crawl_rss_feed_post(workspace_id, rss_item_address)
            set_rss_post_submitted(workspace_id, feed_id, post_id)
            logger.info(f'Finished sending {post_id} ({rss_item_address}) to website crawler')
            dynamodb.update_item(
                TableName=RSS_FEED_TABLE,
                Key={
                    'workspace_id': {
                        'S': workspace_id
                    },
                    'compound_sort_key': {
                        'S': f'feed_id.{feed_id}'
                    }
                },
                UpdateExpression='SET #updated_at = :updated_at',
                ConditionExpression='#document_type = :document_type',
                ExpressionAttributeNames={
                    '#updated_at': 'updated_at',
                    '#document_type': 'document_type'
                },
                ExpressionAttributeValues={
                    ':updated_at': {
                        'S': timestamp
                    },
                    ':document_type': {
                        'S': 'feed'
                    }
                }
            )
            logger.info(f'Updated {feed_id} in {workspace_id} workspace with latest check timestamp')
    else:
        logger.info(f'No pending posts found')

@tracer.capture_method
def _get_batch_pending_posts():
      '''Gets the first 10 Pending Posts from the RSS Feed to Crawl
      '''
      logger.info("Getting Pending RSS Items from dynamoDB table")
      return dynamodb.query(
            TableName=RSS_FEED_TABLE,
            IndexName=RSS_FEED_DOCUMENT_TYPE_STATUS_INDEX,
            Limit=10,
            KeyConditionExpression="#status = :status and #document_type = :document_type",
            ExpressionAttributeValues={ ":status": { "S": "pending" }, ":document_type": { "S": "post" } }, 
            ExpressionAttributeNames={ "#status": "status", "#document_type": "document_type" }
      )

@tracer.capture_method
def get_rss_subscription_details(workspace_id,feed_id):
    '''Gets details about a specified RSS Feed Subscripton'''
    logger.info(f'Getting RSS Feed Details for workspace_id {workspace_id} and feed_id {feed_id}')
    dynamodb_response = dynamodb.query(
        TableName=RSS_FEED_TABLE,
        KeyConditionExpression="#workspace_id = :workspace_id and #compound_sort_key = :compound_sort_key",
        ExpressionAttributeNames={ "#workspace_id": "workspace_id", "#compound_sort_key": "compound_sort_key" },
        ExpressionAttributeValues={ ":workspace_id": { "S": workspace_id }, ":compound_sort_key": { "S": f'feed_id.{feed_id}'} },
    )
    if dynamodb_response['Count'] == 1:
        return {
            'workspaceId': dynamodb_response['Items'][0]['workspace_id']['S'],
            'id': dynamodb_response['Items'][0]['feed_id']['S'],
            'path': dynamodb_response['Items'][0]['url']['S'],
            'title': dynamodb_response['Items'][0]['title']['S'],
            'status': dynamodb_response['Items'][0]['status']['S'],
            'createdAt': dynamodb_response['Items'][0]['created_at']['S'] if "created_at" in dynamodb_response['Items'][0] else "",
            'updatedAt': dynamodb_response['Items'][0]['updated_at']['S'] if "updated_at" in dynamodb_response['Items'][0] else ""
        }

@tracer.capture_method
def check_rss_feed_for_posts(workspace_id, feed_id):
    '''Checks if there are any new RSS Feed Posts'''
    logger.info(f'Checking RSS Feed for new posts for workspace_id {workspace_id} and feed_id {feed_id}')
    feed_contents = _get_rss_feed_posts(workspace_id, feed_id)
    if feed_contents:
        for feed_entry in feed_contents:
            _queue_rss_subscription_post_for_submission(workspace_id, feed_id, feed_entry)
            logger.info(f'Queued RSS Feed Post for ingestion: {feed_entry["link"]}')
    else:
        logger.info(f'No RSS Feed Posts found for workspace_id {workspace_id} and feed_id {feed_id}')
    
    logger.info(f'Marking RSS Feed ID {feed_id} as updated at {timestamp}')
    # Update RSS Feed Subscription to set updated_at date
    dynamodb.update_item(
        TableName=RSS_FEED_TABLE,
        Key={
            'workspace_id': {
                'S': workspace_id
            },
            'compound_sort_key': {
                'S': f'feed_id.{feed_id}'
            },
        },
        ConditionExpression='#document_type = :document_type',
        UpdateExpression={
            'SET updated_at = :updated_at'
        },
        ExpressionAttributeNames={
            "#document_type": "document_type",
        },
        ExpressionAttributeValues={
            ':document_type': {
                'S': 'feed'
            },
            ':updated_at': {
                'S': timestamp
            }
        }
    )

def _get_rss_feed_posts(workspace_id, feed_id):
    '''Gets RSS Feed Details & Parses the RSS Feed'''
    logger.info(f'Getting RSS Feed Posts for workspace_id {workspace_id} and feed_id {feed_id}')
    rss_subscription_details = get_rss_subscription_details(workspace_id, feed_id)
    if rss_subscription_details is None:
        return
    
    rss_feed_url = rss_subscription_details['path']
    feed_contents = feedparser.parse(rss_feed_url)
    return feed_contents['entries']

def _queue_rss_subscription_post_for_submission(workspace_id, feed_id,feed_entry):
    '''Adds RSS Subscription Post to RSS Table to be picked up by scheduled crawling'''
    logger.info(f'Queueing RSS Feed Post for ingestion: {feed_entry["link"]}')
    try:
        post_id = _get_id_for_url(feed_entry['link'])
        dynamodb_response = dynamodb.put_item(
            TableName=RSS_FEED_TABLE,
            Item={
                'workspace_id': {
                    'S': workspace_id
                },
                'compound_sort_key': {
                    'S': f'feed_id.{feed_id}.post_id.{post_id}'
                },
                'document_type': {
                    'S': 'post'
                },
                'feed_id': {
                    'S': feed_id
                },
                'post_id': {
                    'S': post_id
                },
                'title': {
                    'S': feed_entry['title']
                },
                'url': {
                    'S': feed_entry['link']
                },
                'status': {
                    'S': 'pending'
                },
                'created_at': {
                    'S': timestamp
                },
                'updated_at': {
                    'S': timestamp
                }
            },
            ConditionExpression='attribute_not_exists(#compound_sort_key)',
            ExpressionAttributeNames={
                '#compound_sort_key': 'compound_sort_key',
            }
        )
        logger.info(f'Successfully added RSS Feed Post to DynamoDB Table')
        logger.info(f'RSS Feed Post: {dynamodb_response["Attributes"]}')
        return True
    except botocore.exceptions.ClientError as e:
        if e.response['Error']['Code'] != 'ConditionalCheckFailedException':
            logger.error(f'Error adding RSS Feed Post to DynamoDB Table: {e}')
            raise
        else:
            logger.info(f'RSS Feed Post already exists in DynamoDB Table')
    finally:
        logger.error(f'Error! Something went wrong for inserting of {feed_id} with post_url {feed_entry["link"]}')
        return False

def _delete_rss_subscription_schedule(feed_id):
    '''Deletes the EventBridge Scheduler schedule for the Subscription Feed ID provided'''
    logger.info(f'Deleting EventBridge Scheduler schedule for feed_id {feed_id}')
    try:
        scheduler.delete_schedule(
            Name=feed_id,
            GroupName=RSS_SCHEDULE_GROUP_NAME
        )
    except botocore.exceptions.ClientError as error:
        if error.response['Error']['Code'] == 'ResourceNotFoundException':
            logger.info(f'EventBridge Scheduler schedule for feed_id {feed_id} not found. Nothing to delete')
        else:
            logger.error(f'Error Deleting schedule for feed_id {feed_id}',error)

def _delete_workspace_rss_subscription_posts(workspace_id):
    '''Deletes data from DynamoDB RSS Table relating to workspace'''
    logger.info(f'Deleting RSS Feed posts for workspace_id {workspace_id}')
    posts = dynamodb.query(
        TableName=RSS_FEED_TABLE,
        IndexName=RSS_FEED_WORKSPACE_DOCUMENT_TYPE_INDEX,
        KeyConditionExpression="#workspace_id = :workspace_id and #document_type = :document_type",
        ExpressionAttributeValues={ ":workspace_id": { "S": workspace_id }, ":document_type": { "S": "post" } }, 
        ExpressionAttributeNames={ "#workspace_id": "workspace_id", "#document_type": "document_type" }
    )
    if posts['Count'] > 0:
        items_to_delete = posts['Items']
        for i in range(0, len(items_to_delete), 25):
            delete_items = []
            for item in items_to_delete[i : i + 25]:
                delete_items.append({
                    'DeleteRequest': {
                        'Key': {
                            'workspace_id': {
                                'S': workspace_id
                            },
                            'compound_sort_key': {
                                'S': item['compound_sort_key']['S']
                            }
                        }
                    }
                })
            dynamodb.batch_write_item(
                RequestItems={
                    RSS_FEED_TABLE: delete_items
                }
            )
              
@tracer.capture_method    
def delete_workspace_subscriptions(workspace_id):
    '''Deletes all RSS Feed Subscriptions for a Workspace'''
    logger.info(f'Deleting RSS Feed Subscriptions for workspace_id {workspace_id}')
    dynamodb_response = dynamodb.query(
        TableName=RSS_FEED_TABLE,
        IndexName=RSS_FEED_WORKSPACE_DOCUMENT_TYPE_INDEX,
        KeyConditionExpression="#workspace_id = :workspace_id and #document_type = :document_type",
        ExpressionAttributeValues={ ":workspace_id": { "S": workspace_id }, ":document_type": { "S": "feed" } }, 
        ExpressionAttributeNames={ "#workspace_id": "workspace_id", "#document_type": "document_type" }
    )
    if dynamodb_response['Count'] > 0:
        for feed in dynamodb_response['Items']:
            logger.info(f'Deleting RSS Feed Schedule for: {feed["feed_id"]["S"]}')
            if 'schedule_id' in feed:
                logger.info(f'Deleting schedule_id {feed["schedule_id"]["S"]}')
                _delete_rss_subscription_schedule(feed["schedule_id"]["S"])
            else:
                logger.info(f'No schedule_id found for RSS Feed {feed["feed_id"]["S"]}')
        items_to_delete = dynamodb_response['Items']
        for i in range(0, len(items_to_delete), 25):
            delete_items = []
            for item in items_to_delete[i : i + 25]:
                delete_items.append({
                    'DeleteRequest': {
                        'Key': {
                            'workspace_id': {
                                'S': workspace_id
                            },
                            'compound_sort_key': {
                                'S': item['compound_sort_key']['S']
                            }
                        }
                    }
                })
            dynamodb.batch_write_item(
                RequestItems={
                    RSS_FEED_TABLE: delete_items
                }
            )
        _delete_workspace_rss_subscription_posts(workspace_id)        
    else:
        logger.info(f'No RSS Feed Subscriptions found for workspace_id {workspace_id}')
    
@tracer.capture_method
def crawl_rss_feed_post(workspace_id,post_url,link_limit=30):
    '''Creates a Website Crawling Document for the Post from the RSS Feeds'''
    logger.info(f'Starting to crawl RSS Feed post')
    logger.info(f'workspace_id = {workspace_id}')
    logger.info(f'link_limit = {link_limit}')
    logger.info(f'post_url = {post_url}')
    post_url = post_url.strip()[:10000]
    logger.info("Creating Document!")
    return genai_core.documents.create_document(
            workspace_id=workspace_id,
            document_type="website",
            path=post_url,
            crawler_properties={
                "follow_links": True,
                "limit": link_limit,
            },
        )

@tracer.capture_method
def _get_id_for_url(post_url):
    '''Returns an Md5 has string of the post URL to use as a post ID'''
    m = hashlib.md5()
    m.update(post_url.encode('utf-8'))
    return str(m.hexdigest())
