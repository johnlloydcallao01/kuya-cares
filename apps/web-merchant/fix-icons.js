const fs = require('fs');
const path = require('path');

// Find all TypeScript/TSX files in src directory
function findFiles(dir, extension = '.tsx') {
  let results = [];
  const list = fs.readdirSync(dir);
  
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat && stat.isDirectory()) {
      results = results.concat(findFiles(filePath, extension));
    } else if (file.endsWith(extension) || file.endsWith('.ts')) {
      results.push(filePath);
    }
  });
  
  return results;
}

// Replace lucide-react imports with our wrapper
function fixIconImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Check if file uses lucide-react
  if (content.includes('lucide-react')) {
    console.log(`Fixing: ${filePath}`);
    
    // Replace import statement
    content = content.replace(
      /import\s*{([^}]+)}\s*from\s*['"]lucide-react['"];?/g,
      (match, imports) => {
        modified = true;
        return `import { ${imports.trim()} } from '@/components/ui/IconWrapper';`;
      }
    );
    
    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Fixed: ${filePath}`);
    }
  }
}

// Process all files
const srcDir = path.join(__dirname, 'src');
const files = findFiles(srcDir);

console.log(`Found ${files.length} files to process...`);

files.forEach(fixIconImports);

console.log('✅ All icon imports fixed!');
