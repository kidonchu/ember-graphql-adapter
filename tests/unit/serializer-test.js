import { test, module } from 'qunit';
import Serializer from 'ember-graphql-adapter/serializer';
import ModelDouble from '../helpers/model-double';
import StoreDouble from '../helpers/store-double';
import ContainerDouble from '../helpers/container-double';
import SnapshotDouble from '../helpers/snapshot-double';
import Ember from 'ember';

module('unit:ember-graphql-adapter/serializer');

test('normalizing simple scalars', function(assert) {
  let postModel = new ModelDouble('post', ['title', 'body']);
  let store = new StoreDouble({ 'post': postModel });
  let serializer = new Serializer();
  serializer.store = store;

  let payload = {
    'data': {
      'post': {
        'id': '1',
        'title': 'The post title',
        'body': 'The body title',
      }
    }
  };

  let expectedNormalization = {
    'data': {
      'type': 'post',
      'id': '1',
      'attributes': {
        'title': 'The post title',
        'body': 'The body title',
      },
      'relationships': {}

    },
    'included': []
  };

  assert.deepEqual(serializer.normalizeResponse(store, postModel, payload, '1', 'findRecord'), expectedNormalization);
});

test('normalizing simple scalars in array payload', function(assert) {
  let postModel = new ModelDouble('post', ['title', 'body']);
  let store = new StoreDouble({ 'post': postModel });
  let serializer = new Serializer();
  serializer.store = store;

  let payload = {
    'data': {
      'posts': [{
        'id': '1',
        'title': 'The post title',
        'body': 'The body title'
      }, {
        'id': '2',
        'title': 'The other post title',
        'body': 'The other body title'
      }]
    }
  };

  let expectedNormalization = {
    'data': [{
      'type': 'post',
      'id': '1',
      'attributes': {
        'title': 'The post title',
        'body': 'The body title',
      },
      'relationships': {}
    }, {
      'type': 'post',
      'id': '2',
      'attributes': {
        'title': 'The other post title',
        'body': 'The other body title',
      },
      'relationships': {}
    }],
    'included': []
  };

  assert.deepEqual(serializer.normalizeResponse(store, postModel, payload, '1', 'query'), expectedNormalization);
});

test('normalizing with asynchronous relationships', function(assert) {
  let postModel = new ModelDouble('post', ['title', 'body'], [
    ['user', { kind: 'belongsTo', type: 'user', options: { async: true }}],
    ['comments', { kind: 'hasMany', type: 'comment', options: { async: true }}]
  ]);
  let userModel = new ModelDouble('user', ['email', 'name']);
  let commentModel = new ModelDouble('comment', ['body']);
  let store = new StoreDouble({ 'post': postModel, 'user': userModel, 'comment': commentModel });
  let serializer = new Serializer();
  serializer.store = store;

  let payload = {
    'data': {
      'post': {
        'id': '1',
        'title': 'The post title',
        'body': 'The body title',
        'userId': '2',
        'commentIds': ['3', '4']
      }
    }
  };

  let expectedNormalization = {
    'data': {
      'type': 'post',
      'id': '1',
      'attributes': {
        'title': 'The post title',
        'body': 'The body title',
      },
      'relationships': {
        'user': {
          'data': {
            'type': 'user',
            'id': '2'
          }
        },
        'comments': {
          'data': [
            { 'type': 'comment', 'id': '3' },
            { 'type': 'comment', 'id': '4' }
          ]
        }
      }
    },
    'included': []
  };

  assert.deepEqual(serializer.normalizeResponse(store, postModel, payload, '1', 'findRecord'), expectedNormalization);
});

test('normalizing with synchronous relationships', function(assert) {
  let postModel = new ModelDouble('post', ['title', 'body'], [
    ['user', { kind: 'belongsTo', type: 'user', options: { async: false }}],
    ['comments', { kind: 'hasMany', type: 'comment', options: { async: false }}]
  ]);
  let userModel = new ModelDouble('user', ['email', 'name']);
  let commentModel = new ModelDouble('comment', ['body']);
  let store = new StoreDouble({ 'post': postModel, 'user': userModel, 'comment': commentModel });
  let serializer = new Serializer();
  serializer.store = store;

  let payload = {
    'data': {
      'post': {
        'id': '1',
        'title': 'The post title',
        'body': 'The body title',
        'user': {
          'id': '2',
          'email': 'jjbohn@gmail.com',
          'name': 'John Bohn'
        },
        'comments': [
          { 'id': '3', 'body': 'The first comment body' },
          { 'id': '4', 'body': 'The second comment body' }
        ]
      }
    }
  };

  let expectedNormalization = {
    'data': {
      'type': 'post',
      'id': '1',
      'attributes': {
        'title': 'The post title',
        'body': 'The body title',
      },
      'relationships': {
        'user': {
          'data': {
            'type': 'user',
            'id': '2'
          }
        },
        'comments': {
          'data': [
            { 'type': 'comment', 'id': '3' },
            { 'type': 'comment', 'id': '4' }
          ]
        }
      }
    },
    'included': [{
      'type': 'user',
      'id': '2',
      'attributes': {
        'email': 'jjbohn@gmail.com',
        'name': 'John Bohn'
      },
      'relationships': {}
    }, {
      'type': 'comment',
      'id': '3',
      'attributes': {
        'body': 'The first comment body'
      },
      'relationships': {}
    }, {
      'type': 'comment',
      'id': '4',
      'attributes': {
        'body': 'The second comment body'
      },
      'relationships': {}
    }]
  };

  assert.deepEqual(serializer.normalizeResponse(store, postModel, payload, '1', 'findRecord'), expectedNormalization);
});

test('serializes json api style data to a query usable as an ArgumentSet', function(assert) {
  let serializer = new Serializer();
  serializer.container = new ContainerDouble({
    'transform:string': { serialize: function(v) { return v; } }
  });

  let expected = {
    'title': 'The title',
    'body': 'The body',
    'authorId': '1',
    'postIds': ['1']
  };

  let projectAttrs = {
    title: 'The title',
    body: 'The body'
  };

  let projectRels = {
    author: { kind: 'belongsTo', key: 'author', data: { id: '1', modelName: 'user' } },
    posts: { kind: 'hasMany', key: 'posts', data: [{ id: '1', modelName: 'post' }] },
  };

  assert.deepEqual(serializer.serialize(new SnapshotDouble('project', projectAttrs, projectRels)), expected);
});

test('serializes json api style data using custom normalizeCase function', function(assert) {
  let serializer = new Serializer({
    normalizeCase: Ember.String.underscore
  });
  serializer.container = new ContainerDouble({
    'transform:string': { serialize: function(v) { return v; } }
  });

  let expected = {
    'title': 'The title',
    'body': 'The body',
    'long_body': 'The long body',
    'author_id': '1',
    'post_ids': ['1']
  };

  let projectAttrs = {
    title: 'The title',
    body: 'The body',
    longBody: 'The long body'
  };

  let projectRels = {
    author: { kind: 'belongsTo', key: 'author', data: { id: '1', modelName: 'user' } },
    posts: { kind: 'hasMany', key: 'posts', data: [{ id: '1', modelName: 'post' }] },
  };

  assert.deepEqual(serializer.serialize(new SnapshotDouble('project', projectAttrs, projectRels)), expected);
});
