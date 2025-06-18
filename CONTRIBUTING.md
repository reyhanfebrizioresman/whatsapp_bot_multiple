# Contributing to WhatsApp Multi-Session Dashboard

Thank you for your interest in contributing to this project! This document provides guidelines and information for contributors.

## 🤝 How to Contribute

### Reporting Bugs

1. **Check existing issues** - Search the issue tracker to see if the bug has already been reported
2. **Create a new issue** - Use the bug report template and provide:
   - Clear description of the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Node.js version, etc.)
   - Screenshots if applicable

### Suggesting Features

1. **Check existing issues** - Search for similar feature requests
2. **Create a new issue** - Use the feature request template and provide:
   - Clear description of the feature
   - Use cases and benefits
   - Implementation suggestions (if any)
   - Mockups or examples (if applicable)

### Code Contributions

1. **Fork the repository**
2. **Create a feature branch** - Use descriptive branch names like `feature/user-management` or `fix/qr-generation`
3. **Make your changes** - Follow the coding standards below
4. **Test your changes** - Ensure everything works as expected
5. **Commit your changes** - Use conventional commit messages
6. **Push to your fork** - Create a pull request

## 📋 Development Setup

1. **Clone your fork**
   ```bash
   git clone https://github.com/your-username/whatsapp-multi-session2.git
   cd whatsapp-multi-session2
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up database**
   ```bash
   # Create .env file
   cp .env.example .env
   # Edit .env with your database credentials
   
   # Run database setup
   mysql -u root -p < database_setup.sql
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

## 🎯 Coding Standards

### JavaScript/Node.js

- Use **ES6+** features
- Follow **ESLint** rules (if configured)
- Use **async/await** instead of callbacks
- Use **const** and **let** instead of **var**
- Use **arrow functions** where appropriate
- Use **template literals** for string concatenation

### Code Style

- Use **2 spaces** for indentation
- Use **single quotes** for strings
- Use **semicolons** at the end of statements
- Use **camelCase** for variables and functions
- Use **PascalCase** for classes and constructors
- Use **UPPER_SNAKE_CASE** for constants

### File Naming

- Use **kebab-case** for file names: `user-controller.js`
- Use **PascalCase** for class files: `UserModel.js`
- Use **camelCase** for utility files: `databaseConfig.js`

### Comments

- Use **JSDoc** for function documentation
- Write **clear, concise comments** for complex logic
- Explain **why**, not just **what**

### Error Handling

- Always **handle errors** in async functions
- Use **try-catch** blocks appropriately
- Provide **meaningful error messages**
- Log errors for debugging

## 🧪 Testing

### Before Submitting

1. **Test your changes** thoroughly
2. **Check for linting errors**
3. **Ensure all tests pass** (if tests exist)
4. **Test on different browsers** (if frontend changes)
5. **Test with different Node.js versions** (if applicable)

### Testing Checklist

- [ ] Code runs without errors
- [ ] All features work as expected
- [ ] No console errors or warnings
- [ ] Database operations work correctly
- [ ] Authentication flows work properly
- [ ] WhatsApp connections work as expected
- [ ] UI is responsive and accessible

## 📝 Commit Messages

Use **conventional commit messages**:

```
type(scope): description

[optional body]

[optional footer]
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code refactoring
- **test**: Adding or updating tests
- **chore**: Maintenance tasks

### Examples

```
feat(auth): add user registration functionality
fix(qr): resolve QR code generation timeout issue
docs(readme): update installation instructions
style(ui): improve button styling consistency
refactor(services): simplify WhatsApp connection logic
test(api): add unit tests for session endpoints
chore(deps): update dependencies to latest versions
```

## 🔄 Pull Request Process

1. **Update documentation** - Update README, CHANGELOG, etc.
2. **Add tests** - If applicable, add tests for new features
3. **Update version** - Update version in package.json if needed
4. **Create pull request** - Use the PR template
5. **Wait for review** - Address any feedback from maintainers
6. **Merge** - Once approved, your PR will be merged

## 🐛 Bug Fixes

When fixing bugs:

1. **Identify the root cause** - Don't just fix symptoms
2. **Add regression tests** - Prevent the bug from returning
3. **Update documentation** - If the fix changes behavior
4. **Test thoroughly** - Ensure the fix doesn't break other features

## ✨ Feature Development

When adding features:

1. **Plan the feature** - Design the API and UI
2. **Implement incrementally** - Build in small, testable chunks
3. **Add tests** - Ensure the feature works correctly
4. **Update documentation** - Document the new feature
5. **Consider backward compatibility** - Don't break existing functionality

## 🛡️ Security

- **Never commit sensitive data** (passwords, API keys, etc.)
- **Use environment variables** for configuration
- **Validate all inputs** to prevent injection attacks
- **Follow security best practices** for authentication
- **Report security issues** privately to maintainers

## 📞 Getting Help

If you need help:

1. **Check the documentation** - README, code comments, etc.
2. **Search existing issues** - Your question might already be answered
3. **Create an issue** - Use the question template
4. **Join discussions** - Participate in community discussions

## 🎉 Recognition

Contributors will be recognized in:

- **README.md** - List of contributors
- **CHANGELOG.md** - Credit for contributions
- **Release notes** - Mention in release announcements

## 📄 License

By contributing to this project, you agree that your contributions will be licensed under the same license as the project (ISC License).

---

**Thank you for contributing! 🚀** 