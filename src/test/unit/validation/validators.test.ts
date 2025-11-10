import * as assert from 'assert';
import {
  validateChangelist,
  validateAcceptAction,
  validateSearchPattern,
  validateRevision,
  validateFilePath,
  validateRepositoryUrl
} from '../../../validation';

suite('Validation Tests', () => {
  suite('validateChangelist', () => {
    test('accepts valid alphanumeric names', () => {
      assert.strictEqual(validateChangelist('feature-123'), true);
      assert.strictEqual(validateChangelist('bug_fix'), true);
      assert.strictEqual(validateChangelist('MY-TASK-456'), true);
      assert.strictEqual(validateChangelist('test123'), true);
    });

    test('rejects empty or null', () => {
      assert.strictEqual(validateChangelist(''), false);
      assert.strictEqual(validateChangelist(null as any), false);
      assert.strictEqual(validateChangelist(undefined as any), false);
    });

    test('rejects command injection attempts', () => {
      assert.strictEqual(validateChangelist('test; rm -rf'), false);
      assert.strictEqual(validateChangelist('test && echo'), false);
      assert.strictEqual(validateChangelist('test | cat'), false);
      assert.strictEqual(validateChangelist('test`whoami`'), false);
      assert.strictEqual(validateChangelist('test$(whoami)'), false);
    });

    test('rejects special characters', () => {
      assert.strictEqual(validateChangelist('test@domain'), false);
      assert.strictEqual(validateChangelist('test#123'), false);
      assert.strictEqual(validateChangelist('test.branch'), false);
      assert.strictEqual(validateChangelist('test/branch'), false);
      assert.strictEqual(validateChangelist('test\\branch'), false);
    });

    test('rejects whitespace', () => {
      assert.strictEqual(validateChangelist('test branch'), false);
      assert.strictEqual(validateChangelist('test\ttab'), false);
      assert.strictEqual(validateChangelist('test\nnewline'), false);
    });
  });

  suite('validateAcceptAction', () => {
    test('accepts valid SVN accept actions', () => {
      assert.strictEqual(validateAcceptAction('postpone'), true);
      assert.strictEqual(validateAcceptAction('base'), true);
      assert.strictEqual(validateAcceptAction('mine-conflict'), true);
      assert.strictEqual(validateAcceptAction('theirs-conflict'), true);
      assert.strictEqual(validateAcceptAction('mine-full'), true);
      assert.strictEqual(validateAcceptAction('theirs-full'), true);
      assert.strictEqual(validateAcceptAction('edit'), true);
      assert.strictEqual(validateAcceptAction('launch'), true);
      assert.strictEqual(validateAcceptAction('working'), true);
    });

    test('rejects invalid actions', () => {
      assert.strictEqual(validateAcceptAction('invalid'), false);
      assert.strictEqual(validateAcceptAction('mine'), false);
      assert.strictEqual(validateAcceptAction('theirs'), false);
    });

    test('rejects empty or null', () => {
      assert.strictEqual(validateAcceptAction(''), false);
      assert.strictEqual(validateAcceptAction(null as any), false);
      assert.strictEqual(validateAcceptAction(undefined as any), false);
    });

    test('rejects command injection in action', () => {
      assert.strictEqual(validateAcceptAction('postpone; rm -rf'), false);
      assert.strictEqual(validateAcceptAction('base && cat'), false);
      assert.strictEqual(validateAcceptAction('mine`whoami`'), false);
    });

    test('case sensitive validation', () => {
      assert.strictEqual(validateAcceptAction('POSTPONE'), false);
      assert.strictEqual(validateAcceptAction('Base'), false);
      assert.strictEqual(validateAcceptAction('MINE-FULL'), false);
    });
  });

  suite('validateSearchPattern', () => {
    test('accepts safe search patterns', () => {
      assert.strictEqual(validateSearchPattern('function test'), true);
      assert.strictEqual(validateSearchPattern('error: failed'), true);
      assert.strictEqual(validateSearchPattern('TODO.*fix'), true);
      assert.strictEqual(validateSearchPattern('class MyClass'), true);
      assert.strictEqual(validateSearchPattern('import * from'), true);
    });

    test('rejects empty or null', () => {
      assert.strictEqual(validateSearchPattern(''), false);
      assert.strictEqual(validateSearchPattern(null as any), false);
      assert.strictEqual(validateSearchPattern(undefined as any), false);
    });

    test('rejects shell metacharacters', () => {
      assert.strictEqual(validateSearchPattern('test | grep'), false);
      assert.strictEqual(validateSearchPattern('test; echo'), false);
      assert.strictEqual(validateSearchPattern('test$(whoami)'), false);
      assert.strictEqual(validateSearchPattern('test`cat`'), false);
      assert.strictEqual(validateSearchPattern('test\\escape'), false);
    });

    test('rejects shell operators', () => {
      assert.strictEqual(validateSearchPattern('test (group)'), false);
      assert.strictEqual(validateSearchPattern('test [range]'), false);
      assert.strictEqual(validateSearchPattern('test {brace}'), false);
    });

    test('accepts regex patterns without shell chars', () => {
      assert.strictEqual(validateSearchPattern('test.*pattern'), true);
      assert.strictEqual(validateSearchPattern('^start'), true);
      assert.strictEqual(validateSearchPattern('end$'), false); // $ is shell metachar
      assert.strictEqual(validateSearchPattern('test+plus'), true);
      assert.strictEqual(validateSearchPattern('test?question'), true);
    });
  });

  suite('validateRevision', () => {
    test('accepts valid SVN keywords', () => {
      assert.strictEqual(validateRevision('HEAD'), true);
      assert.strictEqual(validateRevision('PREV'), true);
      assert.strictEqual(validateRevision('BASE'), true);
      assert.strictEqual(validateRevision('COMMITTED'), true);
    });

    test('accepts valid numeric revisions', () => {
      assert.strictEqual(validateRevision('0'), true);
      assert.strictEqual(validateRevision('1'), true);
      assert.strictEqual(validateRevision('123'), true);
      assert.strictEqual(validateRevision('999999'), true);
      assert.strictEqual(validateRevision('+123'), true);
    });

    test('rejects empty or null', () => {
      assert.strictEqual(validateRevision(''), false);
      assert.strictEqual(validateRevision(null as any), false);
      assert.strictEqual(validateRevision(undefined as any), false);
    });

    test('rejects invalid keywords', () => {
      assert.strictEqual(validateRevision('WORKING'), false);
      assert.strictEqual(validateRevision('LATEST'), false);
      assert.strictEqual(validateRevision('head'), false); // case sensitive
      assert.strictEqual(validateRevision('prev'), false);
    });

    test('rejects invalid numeric formats', () => {
      assert.strictEqual(validateRevision('01'), false); // leading zero
      assert.strictEqual(validateRevision('00'), false);
      assert.strictEqual(validateRevision('-123'), false); // negative
      assert.strictEqual(validateRevision('1.5'), false); // decimal
      assert.strictEqual(validateRevision('1,000'), false); // comma
    });

    test('rejects command injection', () => {
      assert.strictEqual(validateRevision('123; rm -rf'), false);
      assert.strictEqual(validateRevision('HEAD && echo'), false);
      assert.strictEqual(validateRevision('123`whoami`'), false);
      assert.strictEqual(validateRevision('$(cat)'), false);
    });

    test('accepts edge cases', () => {
      assert.strictEqual(validateRevision('0'), true); // zero is valid
      assert.strictEqual(validateRevision('+0'), true);
    });
  });

  suite('validateFilePath', () => {
    test('accepts safe relative paths', () => {
      assert.strictEqual(validateFilePath('src/file.ts'), true);
      assert.strictEqual(validateFilePath('docs/readme.md'), true);
      assert.strictEqual(validateFilePath('test/unit/test.ts'), true);
      assert.strictEqual(validateFilePath('file.txt'), true);
    });

    test('rejects empty or null', () => {
      assert.strictEqual(validateFilePath(''), false);
      assert.strictEqual(validateFilePath(null as any), false);
      assert.strictEqual(validateFilePath(undefined as any), false);
    });

    test('rejects path traversal attempts', () => {
      assert.strictEqual(validateFilePath('../etc/passwd'), false);
      assert.strictEqual(validateFilePath('../../root'), false);
      assert.strictEqual(validateFilePath('src/../../../etc'), false);
      assert.strictEqual(validateFilePath('./file/../../../'), false);
    });

    test('rejects absolute paths', () => {
      assert.strictEqual(validateFilePath('/etc/passwd'), false);
      assert.strictEqual(validateFilePath('/root/file'), false);
      assert.strictEqual(validateFilePath('\\Windows\\System32'), false);
      assert.strictEqual(validateFilePath('C:\\Windows'), false);
    });

    test('accepts paths with dots but not ..', () => {
      assert.strictEqual(validateFilePath('file.test.ts'), true);
      assert.strictEqual(validateFilePath('.gitignore'), true);
      assert.strictEqual(validateFilePath('.github/workflows'), true);
      assert.strictEqual(validateFilePath('src/.hidden'), true);
    });

    test('edge cases', () => {
      assert.strictEqual(validateFilePath('src/file..txt'), true); // double dot in filename OK
      assert.strictEqual(validateFilePath('...'), true); // three dots OK
      assert.strictEqual(validateFilePath('./relative'), true); // ./ prefix OK
    });
  });

  suite('validateRepositoryUrl', () => {
    test('accepts valid SVN URLs', () => {
      assert.strictEqual(validateRepositoryUrl('http://svn.example.com/repo'), true);
      assert.strictEqual(validateRepositoryUrl('https://svn.example.com/repo'), true);
      assert.strictEqual(validateRepositoryUrl('svn://server/repo'), true);
      assert.strictEqual(validateRepositoryUrl('svn+ssh://user@server/repo'), true);
    });

    test('rejects empty or null', () => {
      assert.strictEqual(validateRepositoryUrl(''), false);
      assert.strictEqual(validateRepositoryUrl(null as any), false);
      assert.strictEqual(validateRepositoryUrl(undefined as any), false);
    });

    test('rejects dangerous protocols', () => {
      assert.strictEqual(validateRepositoryUrl('file:///etc/passwd'), false);
      assert.strictEqual(validateRepositoryUrl('ftp://server/repo'), false);
      assert.strictEqual(validateRepositoryUrl('javascript:alert(1)'), false);
      assert.strictEqual(validateRepositoryUrl('data:text/html,<script>'), false);
    });

    test('rejects command injection in hostname', () => {
      assert.strictEqual(validateRepositoryUrl('http://server;rm-rf/repo'), false);
      assert.strictEqual(validateRepositoryUrl('http://server&&echo/repo'), false);
      assert.strictEqual(validateRepositoryUrl('http://server`whoami`/repo'), false);
      assert.strictEqual(validateRepositoryUrl('http://server$(cat)/repo'), false);
    });

    test('rejects command injection in path', () => {
      assert.strictEqual(validateRepositoryUrl('http://server/repo;rm-rf'), false);
      assert.strictEqual(validateRepositoryUrl('http://server/repo&&echo'), false);
      assert.strictEqual(validateRepositoryUrl('http://server/repo`cat`'), false);
      assert.strictEqual(validateRepositoryUrl('http://server/repo$(ls)'), false);
    });

    test('rejects invalid URL format', () => {
      assert.strictEqual(validateRepositoryUrl('not a url'), false);
      assert.strictEqual(validateRepositoryUrl('ht tp://malformed'), false);
      assert.strictEqual(validateRepositoryUrl('://no-protocol'), false);
    });

    test('accepts URLs with ports and auth', () => {
      assert.strictEqual(validateRepositoryUrl('http://server:8080/repo'), true);
      assert.strictEqual(validateRepositoryUrl('https://user:pass@server/repo'), true);
      assert.strictEqual(validateRepositoryUrl('svn+ssh://user@server:22/repo'), true);
    });

    test('accepts URLs with query params', () => {
      assert.strictEqual(validateRepositoryUrl('http://server/repo?param=value'), true);
      assert.strictEqual(validateRepositoryUrl('https://server/repo?a=1&b=2'), true);
    });

    test('edge cases', () => {
      assert.strictEqual(validateRepositoryUrl('http://localhost/repo'), true);
      assert.strictEqual(validateRepositoryUrl('http://127.0.0.1/repo'), true);
      assert.strictEqual(validateRepositoryUrl('http://[::1]/repo'), true); // IPv6
    });
  });
});
