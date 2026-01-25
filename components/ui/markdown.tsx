// Simple markdown renderer for Ask agent responses
// Handles: headings, bold, italic, lists, code blocks, links, paragraphs

import React from 'react';
import { View, Text, StyleSheet, Linking, ScrollView } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useEffectiveColorScheme } from '@/components/theme';

interface MarkdownProps {
  children: string;
  style?: any;
}

interface MarkdownNode {
  type: 'text' | 'heading' | 'bold' | 'italic' | 'code' | 'link' | 'listItem' | 'paragraph' | 'codeBlock' | 'table';
  content: string;
  level?: number; // for headings
  href?: string; // for links
  children?: MarkdownNode[];
  rows?: string[][]; // for tables
}

function parseMarkdown(text: string): MarkdownNode[] {
  const nodes: MarkdownNode[] = [];
  const lines = text.split('\n');
  let currentParagraph: string[] = [];
  let inTable = false;
  let tableRows: string[][] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      nodes.push(parseInlineMarkdown(currentParagraph.join(' ')));
      currentParagraph = [];
    }
  };

  const flushTable = () => {
    if (tableRows.length > 0) {
      nodes.push({ type: 'table' as any, content: '', rows: tableRows });
      tableRows = [];
      inTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Code block
    if (line.startsWith('```')) {
      flushParagraph();
      flushTable();
      const codeBlock: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeBlock.push(lines[i]);
        i++;
      }
      nodes.push({ type: 'codeBlock', content: codeBlock.join('\n') });
      continue;
    }

    // Table row (contains | and not just separator)
    if (line.includes('|')) {
      const isSeparator = /^\|?[\s\-:|]+\|?$/.test(line);
      if (!isSeparator) {
        flushParagraph();
        inTable = true;
        const cells = line.split('|').map(c => c.trim()).filter((c, idx, arr) => {
          // Filter out empty first/last cells from leading/trailing pipes
          if (idx === 0 && c === '') return false;
          if (idx === arr.length - 1 && c === '') return false;
          return true;
        });
        if (cells.length > 0) {
          tableRows.push(cells);
        }
        continue;
      } else {
        // Skip separator lines
        continue;
      }
    } else if (inTable) {
      flushTable();
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushTable();
      nodes.push({
        type: 'heading',
        level: headingMatch[1].length,
        content: headingMatch[2],
      });
      continue;
    }

    // List item
    const listMatch = line.match(/^[-*+]\s+(.+)$/);
    if (listMatch) {
      flushParagraph();
      flushTable();
      nodes.push({
        type: 'listItem',
        content: listMatch[1],
      });
      continue;
    }

    // Ordered list
    const orderedListMatch = line.match(/^\d+\.\s+(.+)$/);
    if (orderedListMatch) {
      flushParagraph();
      flushTable();
      nodes.push({
        type: 'listItem',
        content: orderedListMatch[1],
      });
      continue;
    }

    // Empty line = paragraph break
    if (line === '') {
      flushParagraph();
      flushTable();
      continue;
    }

    currentParagraph.push(line);
  }

  flushParagraph();
  flushTable();

  return nodes;
}

function parseInlineMarkdown(text: string): MarkdownNode {
  // Split-based approach for better reliability
  const children: MarkdownNode[] = [];
  
  // Process bold first (** markers)
  const processBold = (input: string): MarkdownNode[] => {
    const parts = input.split(/\*\*([^*]+)\*\*/g);
    const result: MarkdownNode[] = [];
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === '') continue;
      if (i % 2 === 1) {
        // Odd indices are bold content
        result.push({ type: 'bold', content: parts[i] });
      } else {
        // Even indices are regular text, process further
        result.push(...processItalic(parts[i]));
      }
    }
    return result;
  };

  // Process italic (* markers) 
  const processItalic = (input: string): MarkdownNode[] => {
    const parts = input.split(/\*([^*]+)\*/g);
    const result: MarkdownNode[] = [];
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === '') continue;
      if (i % 2 === 1) {
        result.push({ type: 'italic', content: parts[i] });
      } else {
        result.push(...processCode(parts[i]));
      }
    }
    return result;
  };

  // Process inline code (` markers)
  const processCode = (input: string): MarkdownNode[] => {
    const parts = input.split(/`([^`]+)`/g);
    const result: MarkdownNode[] = [];
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === '') continue;
      if (i % 2 === 1) {
        result.push({ type: 'code', content: parts[i] });
      } else {
        result.push(...processLinks(parts[i]));
      }
    }
    return result;
  };

  // Process links
  const processLinks = (input: string): MarkdownNode[] => {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const result: MarkdownNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(input)) !== null) {
      if (match.index > lastIndex) {
        const beforeText = input.substring(lastIndex, match.index);
        if (beforeText) result.push({ type: 'text', content: beforeText });
      }
      result.push({ type: 'link', content: match[1], href: match[2] });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < input.length) {
      const remainingText = input.substring(lastIndex);
      if (remainingText) result.push({ type: 'text', content: remainingText });
    }

    if (result.length === 0 && input) {
      result.push({ type: 'text', content: input });
    }

    return result;
  };

  const processed = processBold(text);
  children.push(...processed);

  return { type: 'paragraph', content: '', children };
}

export function Markdown({ children, style }: MarkdownProps) {
  const colorScheme = useEffectiveColorScheme();
  const colors = Colors[colorScheme];
  const nodes = parseMarkdown(children);

  const renderNode = (node: MarkdownNode, index: number) => {
    switch (node.type) {
      case 'heading':
        const headingStyle = [
          styles.heading,
          node.level === 1 && styles.heading1,
          node.level === 2 && styles.heading2,
          node.level === 3 && styles.heading3,
          { color: colors.text },
        ];
        return (
          <Text key={index} style={headingStyle}>
            {node.content}
          </Text>
        );

      case 'listItem':
        return (
          <View key={index} style={styles.listItem}>
            <Text style={[styles.bullet, { color: colors.text }]}>• </Text>
            <View style={styles.listItemContent}>
              <Text style={[styles.listItemText, { color: colors.text }]}>
                {renderInlineText(node.content)}
              </Text>
            </View>
          </View>
        );

      case 'codeBlock':
        return (
          <View key={index} style={[styles.codeBlock, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Text style={[styles.codeBlockText, { color: colors.text }]}>{node.content}</Text>
          </View>
        );

      case 'table':
        const columnCount = node.rows?.[0]?.length || 1;
        return (
          <ScrollView key={index} horizontal showsHorizontalScrollIndicator={true} style={styles.tableScroll}>
            <View style={[styles.table, { borderColor: colors.border }]}>
              {node.rows?.map((row, rowIndex) => (
                <View 
                  key={rowIndex} 
                  style={[
                    styles.tableRow, 
                    { borderBottomColor: colors.border },
                    rowIndex === 0 && { backgroundColor: colors.muted },
                    rowIndex === (node.rows?.length || 1) - 1 && { borderBottomWidth: 0 }
                  ]}
                >
                  {row.map((cell, cellIndex) => (
                    <View 
                      key={cellIndex} 
                      style={[
                        styles.tableCell, 
                        { borderRightColor: colors.border, minWidth: 80 },
                        cellIndex === row.length - 1 && { borderRightWidth: 0 }
                      ]}
                    >
                      <Text style={[
                        styles.tableCellText, 
                        { color: colors.text },
                        rowIndex === 0 && styles.tableHeaderText
                      ]}>
                        {renderInlineText(cell)}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        );

      case 'paragraph':
        return (
          <View key={index} style={styles.paragraph}>
            {node.children?.map((child, childIndex) => renderInlineNode(child, childIndex))}
          </View>
        );

      default:
        return null;
    }
  };

  // Helper to render inline markdown in strings (for list items, table cells)
  const renderInlineText = (text: string): React.ReactNode => {
    const parsed = parseInlineMarkdown(text);
    if (parsed.children && parsed.children.length > 0) {
      return parsed.children.map((child, idx) => renderInlineNode(child, idx));
    }
    return text;
  };

  const renderInlineNode = (node: MarkdownNode, index: number) => {
    switch (node.type) {
      case 'text':
        return <Text key={index} style={[styles.text, { color: colors.text }]}>{node.content}</Text>;
      case 'bold':
        return <Text key={index} style={[styles.bold, { color: colors.text }]}>{node.content}</Text>;
      case 'italic':
        return <Text key={index} style={[styles.italic, { color: colors.text }]}>{node.content}</Text>;
      case 'code':
        return (
          <Text key={index} style={[styles.code, { backgroundColor: colors.muted, color: colors.text }]}>
            {node.content}
          </Text>
        );
      case 'link':
        return (
          <Text
            key={index}
            style={[styles.link, { color: colors.primary }]}
            onPress={() => node.href && Linking.openURL(node.href)}
          >
            {node.content}
          </Text>
        );
      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, style]}>
      {nodes.map((node, index) => renderNode(node, index))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  paragraph: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  heading: {
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
  },
  heading1: {
    fontSize: 22,
  },
  heading2: {
    fontSize: 18,
  },
  heading3: {
    fontSize: 16,
  },
  bold: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  italic: {
    fontStyle: 'italic',
    fontSize: 15,
  },
  code: {
    fontFamily: 'monospace',
    fontSize: 13,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  codeBlock: {
    padding: 12,
    borderRadius: 4,
    borderWidth: 1,
    marginVertical: 8,
  },
  codeBlockText: {
    fontFamily: 'monospace',
    fontSize: 13,
  },
  link: {
    textDecorationLine: 'underline',
    fontSize: 15,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 8,
  },
  listItemContent: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  listItemText: {
    fontSize: 15,
    lineHeight: 22,
  },
  bullet: {
    fontSize: 15,
    marginRight: 4,
  },
  // Table styles
  tableScroll: {
    marginVertical: 8,
  },
  table: {
    borderWidth: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tableHeader: {
    // Header row styling applied via inline style
  },
  tableCell: {
    flex: 1,
    padding: 8,
    borderRightWidth: 1,
  },
  tableCellText: {
    fontSize: 13,
  },
  tableHeaderText: {
    fontWeight: 'bold',
    fontSize: 13,
  },
});
