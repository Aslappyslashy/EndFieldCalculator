import { PipelineDiagram } from '../PipelineDiagram';
import { buildZoneFlowGraphForZone } from '../../utils/flowGraph';
import type { CalculatorResult, Recipe, ZoneResult } from '../../types';

interface ZoneReportViewProps {
  zoneResult: ZoneResult;
  result: CalculatorResult;
  recipes: Recipe[];
  itemNameById: Map<string, string>;
  recipeNameById: Map<string, string>;
  machineNameById: Map<string, string>;
  nodePositions: Record<string, { x: number; y: number }>;
  onLayoutChange: (newPositions: Record<string, { x: number; y: number }>) => void;
}

export function ZoneReportView({
  zoneResult,
  result,
  recipes,
  itemNameById,
  recipeNameById,
  machineNameById,
  nodePositions,
  onLayoutChange
}: ZoneReportViewProps) {
  return (
    <div key={zoneResult.zone.id} className="zone-report-v2">
      <div className="zone-report-header">
        <h4>区域详情: {zoneResult.zone.name}</h4>
        <div className="zone-usage-group">
          <div className="zone-usage">
            <span className="usage-text">
              出口占用: {zoneResult.outputPortsUsed.toFixed(1)} / {zoneResult.zone.outputPorts}
            </span>
            <div className="usage-bar">
              <div
                className="fill"
                style={{
                  width: `${Math.min(100, (zoneResult.outputPortsUsed / zoneResult.zone.outputPorts) * 100)}%`,
                  background:
                    zoneResult.outputPortsUsed > zoneResult.zone.outputPorts
                      ? 'var(--c-error)'
                      : 'var(--c-accent)'
                }}
              ></div>
            </div>
          </div>
          <div className="zone-usage">
            <span className="usage-text">
              入口占用: {zoneResult.inputPortsUsed.toFixed(1)} / {zoneResult.zone.inputPorts}
            </span>
            <div className="usage-bar">
              <div
                className="fill"
                style={{
                  width: `${Math.min(100, (zoneResult.inputPortsUsed / zoneResult.zone.inputPorts) * 100)}%`,
                  background:
                    zoneResult.inputPortsUsed > zoneResult.zone.inputPorts
                      ? 'var(--c-error)'
                      : 'var(--c-accent)'
                }}
              ></div>
            </div>
          </div>
          {zoneResult.zone.areaLimit && (
            <div className="zone-usage">
              <span className="usage-text">
                面积占用: {zoneResult.areaUsed?.toFixed(0)} / {zoneResult.zone.areaLimit}
              </span>
              <div className="usage-bar">
                <div
                  className="fill"
                  style={{
                    width: `${Math.min(
                      100,
                      ((zoneResult.areaUsed || 0) / zoneResult.zone.areaLimit) * 100
                    )}%`,
                    background:
                      (zoneResult.areaUsed || 0) > zoneResult.zone.areaLimit
                        ? 'var(--c-error)'
                        : 'var(--c-accent)'
                  }}
                ></div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="details-grid full-height">
        <div className="details-main">
          <section className="io-section-v2">
            <div className="pipeline-container-full">
              {(() => {
                const g = buildZoneFlowGraphForZone({
                  result,
                  zoneId: zoneResult.zone.id,
                  recipes,
                  itemNameById,
                  recipeNameById,
                  machineNameById
                });
                if (!g || g.nodes.length === 0)
                  return <div className="empty-graph">No production flow detected.</div>;
                return (
                  <PipelineDiagram
                    graph={g}
                    savedPositions={nodePositions}
                    onLayoutChange={onLayoutChange}
                  />
                );
              })()}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
